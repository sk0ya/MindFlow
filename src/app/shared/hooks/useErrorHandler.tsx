import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { logger } from '../utils/logger';
import { useNotification } from './useNotification';

export interface ErrorInfo {
  error: Error;
  errorInfo?: React.ErrorInfo;
  context?: string;
  action?: string;
  userId?: string;
}

export interface ErrorHandlerContextType {
  handleError: (error: Error, context?: string, action?: string) => void;
  handleAsyncError: (promise: Promise<any>, context?: string, action?: string) => Promise<any>;
}

const ErrorHandlerContext = createContext<ErrorHandlerContextType | undefined>(undefined);

interface ErrorHandlerProviderProps {
  children: ReactNode;
  userId?: string;
}

// エラーの種類を判定する関数
const getErrorType = (error: Error): 'network' | 'validation' | 'auth' | 'storage' | 'unknown' => {
  const message = error.message.toLowerCase();
  
  if (message.includes('fetch') || message.includes('network') || message.includes('failed to fetch')) {
    return 'network';
  }
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return 'validation';
  }
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
    return 'auth';
  }
  if (message.includes('storage') || message.includes('indexeddb') || message.includes('localstorage')) {
    return 'storage';
  }
  
  return 'unknown';
};

// ユーザーフレンドリーなエラーメッセージを生成
const generateUserFriendlyMessage = (error: Error, context?: string, action?: string): string => {
  const errorType = getErrorType(error);
  
  switch (errorType) {
    case 'network':
      return 'ネットワーク接続に問題があります。インターネット接続を確認してください。';
    case 'validation':
      return '入力内容に問題があります。入力値を確認してください。';
    case 'auth':
      return '認証に失敗しました。ログインし直してください。';
    case 'storage':
      return 'データの保存に失敗しました。ブラウザの容量を確認してください。';
    default:
      if (context && action) {
        return `${action}に失敗しました。しばらく待ってから再試行してください。`;
      }
      return '予期しないエラーが発生しました。しばらく待ってから再試行してください。';
  }
};

// エラーレポートの生成
const generateErrorReport = (errorInfo: ErrorInfo): object => {
  return {
    timestamp: new Date().toISOString(),
    message: errorInfo.error.message,
    stack: errorInfo.error.stack,
    context: errorInfo.context,
    action: errorInfo.action,
    userId: errorInfo.userId,
    userAgent: navigator.userAgent,
    url: window.location.href,
    type: getErrorType(errorInfo.error),
  };
};

export const ErrorHandlerProvider: React.FC<ErrorHandlerProviderProps> = ({ children, userId }) => {
  const { showNotification } = useNotification();

  const handleError = useCallback((error: Error, context?: string, action?: string) => {
    const errorInfo: ErrorInfo = {
      error,
      context,
      action,
      userId,
    };

    // エラーレポートを生成してログに記録
    const errorReport = generateErrorReport(errorInfo);
    logger.error('Application error occurred:', errorReport);

    // ユーザーフレンドリーなメッセージを生成して通知
    const userMessage = generateUserFriendlyMessage(error, context, action);
    showNotification('error', userMessage);

    // 開発環境ではコンソールにも詳細を出力
    if (import.meta.env.DEV) {
      console.group('🚨 Error Details');
      console.error('Original error:', error);
      console.log('Context:', context);
      console.log('Action:', action);
      console.log('Error report:', errorReport);
      console.groupEnd();
    }
  }, [showNotification, userId]);

  const handleAsyncError = useCallback(async (promise: Promise<any>, context?: string, action?: string): Promise<any> => {
    try {
      return await promise;
    } catch (error) {
      handleError(error as Error, context, action);
      throw error; // 呼び出し元で適切に処理できるように再スロー
    }
  }, [handleError]);

  return (
    <ErrorHandlerContext.Provider value={{ handleError, handleAsyncError }}>
      {children}
    </ErrorHandlerContext.Provider>
  );
};

export const useErrorHandler = (): ErrorHandlerContextType => {
  const context = useContext(ErrorHandlerContext);
  if (!context) {
    throw new Error('useErrorHandler must be used within an ErrorHandlerProvider');
  }
  return context;
};

// グローバルエラーハンドラーの設定
export const setupGlobalErrorHandlers = (handleError: (error: Error, context?: string, action?: string) => void) => {
  // 未処理のPromiseエラーをキャッチ
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection:', event.reason);
    handleError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      'Global',
      'Promise rejection'
    );
    event.preventDefault(); // デフォルトのエラー表示を防ぐ
  });

  // JavaScriptエラーをキャッチ
  window.addEventListener('error', (event) => {
    logger.error('Global JavaScript error:', event.error);
    handleError(
      event.error || new Error(event.message),
      'Global',
      'JavaScript error'
    );
  });

  logger.info('Global error handlers set up successfully');
};