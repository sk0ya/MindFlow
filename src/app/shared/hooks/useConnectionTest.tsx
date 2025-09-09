import { useState, useCallback } from 'react';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

interface ConnectionTestResult {
  success: boolean;
  error?: string;
}

interface UseConnectionTestOptions {
  testConnection: () => Promise<ConnectionTestResult>;
  clearError: () => void;
  onSuccess?: () => Promise<void>;
}

interface UseConnectionTestReturn {
  connectionStatus: ConnectionStatus;
  connectionError: string;
  handleTestConnection: () => Promise<void>;
  resetConnection: () => void;
}

export const useConnectionTest = ({
  testConnection,
  clearError,
  onSuccess
}: UseConnectionTestOptions): UseConnectionTestReturn => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionError, setConnectionError] = useState<string>('');

  const formatCORSError = (error: string): string => {
    if (error.includes('CORS') || error.includes('Failed to fetch')) {
      return 'CORSポリシーエラー: デプロイされたアプリからローカルOllamaにアクセスできません。ローカル開発環境（localhost）で実行してください。';
    }
    return error;
  };

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus('testing');
    setConnectionError('');
    clearError();
    
    try {
      const result = await testConnection();
      if (result.success) {
        setConnectionStatus('success');
        // 接続成功時のコールバック実行
        if (onSuccess) {
          await onSuccess();
        }
      } else {
        setConnectionStatus('error');
        const error = result.error || '接続に失敗しました';
        setConnectionError(formatCORSError(error));
      }
    } catch (error) {
      setConnectionStatus('error');
      const errorMessage = error instanceof Error ? error.message : '接続テストでエラーが発生しました';
      setConnectionError(formatCORSError(errorMessage));
    }
  }, [testConnection, clearError, onSuccess]);

  const resetConnection = useCallback(() => {
    setConnectionStatus('idle');
    setConnectionError('');
  }, []);

  return {
    connectionStatus,
    connectionError,
    handleTestConnection,
    resetConnection
  };
};