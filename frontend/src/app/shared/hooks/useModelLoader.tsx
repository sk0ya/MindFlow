import { useState, useCallback } from 'react';
import { logger } from '../utils/logger';

interface UseModelLoaderOptions {
  getAvailableModels: () => Promise<string[]>;
  currentModel: string;
  updateModel: (model: string) => void;
  onCORSError?: (error: string) => void;
}

interface UseModelLoaderReturn {
  availableModels: string[];
  isLoadingModels: boolean;
  loadModels: () => Promise<void>;
  setAvailableModels: (models: string[]) => void;
}

export const useModelLoader = ({
  getAvailableModels,
  currentModel,
  updateModel,
  onCORSError
}: UseModelLoaderOptions): UseModelLoaderReturn => {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const loadModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const models = await getAvailableModels();
      setAvailableModels(models);
      
      // 現在のモデルがリストにない場合、最初のモデルを選択
      if (models.length > 0 && !models.includes(currentModel)) {
        updateModel(models[0]);
      }
    } catch (error) {
      logger.error('Failed to load models:', error);
      setAvailableModels([]);
      
      // CORSエラーの場合は親コンポーネントに通知
      const errorMessage = error instanceof Error ? error.message : '';
      if ((errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) && onCORSError) {
        const corsError = 'CORSポリシーエラー: デプロイされたアプリからローカルOllamaにアクセスできません。ローカル開発環境（localhost）で実行してください。';
        onCORSError(corsError);
      }
    } finally {
      setIsLoadingModels(false);
    }
  }, [getAvailableModels, currentModel, updateModel, onCORSError]);

  return {
    availableModels,
    isLoadingModels,
    loadModels,
    setAvailableModels
  };
};