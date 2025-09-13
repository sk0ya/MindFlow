import { useCallback, useState } from 'react';
import { useNotification } from './useNotification';
import { useErrorHandler } from './useErrorHandler';
import { useFileUpload, createUploadId } from './useFileUpload';
import { logger } from '../utils/logger';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // ミリ秒
  backoffMultiplier: number; // 遅延を増加させる倍率
}

export interface UploadAttempt {
  attemptNumber: number;
  error?: Error;
  timestamp: number;
}

export interface RetryableUploadState {
  isUploading: boolean;
  attempts: UploadAttempt[];
  currentUploadId?: string;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1秒
  backoffMultiplier: 2, // 2倍ずつ増加
};

export const useRetryableUpload = (config: Partial<RetryConfig> = {}) => {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const { showNotification } = useNotification();
  const { handleError } = useErrorHandler();
  const { startUpload, updateProgress, completeUpload, errorUpload } = useFileUpload();
  
  const [uploadStates, setUploadStates] = useState<Record<string, RetryableUploadState>>({});

  const getRetryDelay = (attemptNumber: number): number => {
    return retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, attemptNumber - 1);
  };

  const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const retryableUpload = useCallback(async <T,>(
    uploadKey: string,
    fileName: string,
    uploadFunction: () => Promise<T>,
    onProgress?: (progress: number) => void
  ): Promise<T> => {
    // アップロード状態を初期化
    setUploadStates(prev => ({
      ...prev,
      [uploadKey]: {
        isUploading: true,
        attempts: [],
        currentUploadId: createUploadId(fileName),
      }
    }));

    const state = uploadStates[uploadKey] || {
      isUploading: true,
      attempts: [],
      currentUploadId: createUploadId(fileName),
    };

    if (state.currentUploadId) {
      startUpload(state.currentUploadId, fileName);
    }

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
      try {
        // 進捗を更新
        if (onProgress) {
          onProgress(Math.min(95, (attempt - 1) * 10 + 10));
        }
        if (state.currentUploadId) {
          updateProgress(state.currentUploadId, Math.min(95, (attempt - 1) * 10 + 10));
        }

        logger.info(`Upload attempt ${attempt}/${retryConfig.maxRetries + 1}`, {
          uploadKey,
          fileName,
          attempt,
        });

        // アップロード実行
        const result = await uploadFunction();

        // 成功時の処理
        setUploadStates(prev => ({
          ...prev,
          [uploadKey]: {
            ...prev[uploadKey],
            isUploading: false,
          }
        }));

        if (state.currentUploadId) {
          completeUpload(state.currentUploadId);
        }

        if (attempt > 1) {
          showNotification('success', `${fileName} のアップロードが${attempt}回目で成功しました`);
        }

        logger.info('Upload successful', {
          uploadKey,
          fileName,
          attempt,
          totalAttempts: attempt,
        });

        return result;

      } catch (error) {
        lastError = error as Error;
        
        // 試行記録を更新
        setUploadStates(prev => ({
          ...prev,
          [uploadKey]: {
            ...prev[uploadKey],
            attempts: [
              ...prev[uploadKey].attempts,
              {
                attemptNumber: attempt,
                error: lastError,
                timestamp: Date.now(),
              }
            ]
          }
        }));

        logger.warn(`Upload attempt ${attempt} failed`, {
          uploadKey,
          fileName,
          attempt,
          error: lastError.message,
        });

        // 最後の試行でない場合はリトライ
        if (attempt <= retryConfig.maxRetries) {
          const delay = getRetryDelay(attempt);
          
          showNotification('warning', 
            `${fileName} のアップロードに失敗しました。${delay/1000}秒後に再試行します... (${attempt}/${retryConfig.maxRetries})`
          );

          // 新しいアップロードIDでリトライ
          if (state.currentUploadId) {
            errorUpload(state.currentUploadId, `試行 ${attempt} 失敗 - 再試行中...`);
          }
          
          const newUploadId = createUploadId(`${fileName}_retry_${attempt}`);
          setUploadStates(prev => ({
            ...prev,
            [uploadKey]: {
              ...prev[uploadKey],
              currentUploadId: newUploadId,
            }
          }));

          startUpload(newUploadId, `${fileName} (再試行 ${attempt})`);
          
          await sleep(delay);
        } else {
          // 全ての試行が失敗した場合
          setUploadStates(prev => ({
            ...prev,
            [uploadKey]: {
              ...prev[uploadKey],
              isUploading: false,
            }
          }));

          if (state.currentUploadId) {
            errorUpload(state.currentUploadId, `${retryConfig.maxRetries}回の再試行に失敗しました`);
          }

          const errorMessage = `${fileName} のアップロードに失敗しました（${retryConfig.maxRetries}回試行）`;
          showNotification('error', errorMessage);
          
          handleError(lastError, 'ファイルアップロード', `${fileName}のアップロード（リトライ機能付き）`);
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Unknown upload error');
  }, [retryConfig, showNotification, handleError, startUpload, updateProgress, completeUpload, errorUpload, uploadStates]);

  const getUploadState = useCallback((uploadKey: string): RetryableUploadState | undefined => {
    return uploadStates[uploadKey];
  }, [uploadStates]);

  const clearUploadState = useCallback((uploadKey: string) => {
    setUploadStates(prev => {
      const { [uploadKey]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  return {
    retryableUpload,
    getUploadState,
    clearUploadState,
    config: retryConfig,
  };
};