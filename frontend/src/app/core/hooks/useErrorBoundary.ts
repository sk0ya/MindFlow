import { useCallback } from 'react';
import { logger } from '../../shared/utils/logger';
import { type Result, tryCatchAsync, isFailure } from '../../shared/types/result';

export interface ErrorBoundaryOptions {
  onError?: (_error: Error) => void;
  fallbackResult?: unknown;
}

/**
 * エラーハンドリングを統一するhook
 */
export const useErrorBoundary = (options: ErrorBoundaryOptions = {}) => {
  const { onError, fallbackResult } = options;

  const handleError = useCallback((error: Error, context?: string) => {
    const errorMessage = `Error${context ? ` in ${context}` : ''}: ${error.message}`;
    logger.error(errorMessage, error);
    onError?.(error);
  }, [onError]);

  const withErrorBoundary = useCallback(
    async <T>(
      asyncOperation: () => Promise<T>,
      context?: string
    ): Promise<Result<T, Error>> => {
      const result = await tryCatchAsync(asyncOperation);
      
      if (isFailure(result)) {
        handleError(result.error, context);
      }
      
      return result;
    },
    [handleError]
  );

  const safeExecute = useCallback(
    async <T>(
      asyncOperation: () => Promise<T>,
      fallback?: T,
      context?: string
    ): Promise<T> => {
      const result = await withErrorBoundary(asyncOperation, context);
      
      if (isFailure(result)) {
        return fallback ?? fallbackResult as T;
      }
      
      return result.data;
    },
    [withErrorBoundary, fallbackResult]
  );

  return {
    handleError,
    withErrorBoundary,
    safeExecute
  };
};