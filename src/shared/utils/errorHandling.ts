/**
 * Error handling utilities for async operations and general error management
 */

// Types for error handling
export interface AppError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  timestamp: string;
  stack?: string;
}

export interface ErrorHandler {
  (error: Error | AppError, context?: Record<string, any>): void;
}

export interface AsyncResult<T> {
  data?: T;
  error?: AppError;
  success: boolean;
}

// Error codes
export const ERROR_CODES = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  
  // Data errors
  DATA_INVALID: 'DATA_INVALID',
  DATA_NOT_FOUND: 'DATA_NOT_FOUND',
  DATA_CORRUPTED: 'DATA_CORRUPTED',
  
  // Storage errors
  STORAGE_FULL: 'STORAGE_FULL',
  STORAGE_ERROR: 'STORAGE_ERROR',
  
  // Business logic errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  OPERATION_FAILED: 'OPERATION_FAILED',
  
  // System errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  HIGH: 'high' as const,
  CRITICAL: 'critical' as const
};

// Create standardized error
export const createAppError = (
  code: string,
  message: string,
  severity: AppError['severity'] = 'medium',
  context?: Record<string, any>
): AppError => ({
  code,
  message,
  severity,
  context,
  timestamp: new Date().toISOString(),
  stack: new Error().stack
});

// Error classification
export const classifyError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return createAppError(
        ERROR_CODES.NETWORK_ERROR,
        'Network connection failed. Please check your internet connection.',
        ERROR_SEVERITY.HIGH,
        { originalMessage: error.message, stack: error.stack }
      );
    }

    // Auth errors
    if (error.message.includes('401') || error.message.includes('authentication')) {
      return createAppError(
        ERROR_CODES.AUTH_REQUIRED,
        'Authentication required. Please log in.',
        ERROR_SEVERITY.MEDIUM,
        { originalMessage: error.message }
      );
    }

    // Validation errors
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return createAppError(
        ERROR_CODES.VALIDATION_ERROR,
        error.message,
        ERROR_SEVERITY.LOW,
        { originalMessage: error.message }
      );
    }

    // Generic error
    return createAppError(
      ERROR_CODES.UNKNOWN_ERROR,
      error.message || 'An unexpected error occurred',
      ERROR_SEVERITY.MEDIUM,
      { originalMessage: error.message, stack: error.stack }
    );
  }

  // Non-Error objects
  return createAppError(
    ERROR_CODES.UNKNOWN_ERROR,
    typeof error === 'string' ? error : 'An unknown error occurred',
    ERROR_SEVERITY.MEDIUM,
    { originalError: error }
  );
};

// Type guard for AppError
export const isAppError = (error: unknown): error is AppError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'severity' in error &&
    'timestamp' in error
  );
};

// Safe async wrapper
export const safeAsync = async <T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<AsyncResult<T>> => {
  try {
    const data = await operation();
    return { data, success: true };
  } catch (error) {
    const appError = classifyError(error);
    if (context) {
      appError.context = { ...appError.context, ...context };
    }
    
    // Log error
    console.error('SafeAsync error:', appError);
    
    return { error: appError, success: false };
  }
};

// Retry wrapper with exponential backoff
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context?: Record<string, any>
): Promise<AsyncResult<T>> => {
  let lastError: AppError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await safeAsync(operation, {
      ...context,
      attempt: attempt + 1,
      maxRetries: maxRetries + 1
    });

    if (result.success) {
      return result;
    }

    lastError = result.error;

    // Don't retry on certain error types
    if (result.error?.code === ERROR_CODES.AUTH_REQUIRED ||
        result.error?.code === ERROR_CODES.PERMISSION_DENIED ||
        result.error?.code === ERROR_CODES.VALIDATION_ERROR) {
      break;
    }

    // Don't delay after the last attempt
    if (attempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return { error: lastError, success: false };
};

// Global error handler
class GlobalErrorHandler {
  private handlers: ErrorHandler[] = [];
  private errorHistory: AppError[] = [];
  private readonly maxHistorySize = 50;

  addHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }

  removeHandler(handler: ErrorHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  handle(error: unknown, context?: Record<string, any>): void {
    const appError = classifyError(error);
    if (context) {
      appError.context = { ...appError.context, ...context };
    }

    // Add to history
    this.errorHistory.push(appError);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Store in localStorage for persistence
    try {
      const storedErrors = JSON.parse(localStorage.getItem('mindflow_global_errors') || '[]');
      storedErrors.push(appError);
      if (storedErrors.length > 20) {
        storedErrors.splice(0, storedErrors.length - 20);
      }
      localStorage.setItem('mindflow_global_errors', JSON.stringify(storedErrors));
    } catch (e) {
      console.warn('Failed to store error in localStorage:', e);
    }

    // Call all handlers
    this.handlers.forEach(handler => {
      try {
        handler(appError, context);
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    });

    // Log to console based on severity
    switch (appError.severity) {
      case 'critical':
        console.error('🚨 CRITICAL ERROR:', appError);
        break;
      case 'high':
        console.error('❌ HIGH SEVERITY ERROR:', appError);
        break;
      case 'medium':
        console.warn('⚠️ ERROR:', appError);
        break;
      case 'low':
        console.info('ℹ️ Minor error:', appError);
        break;
    }
  }

  getErrorHistory(): AppError[] {
    return [...this.errorHistory];
  }

  clearHistory(): void {
    this.errorHistory = [];
    localStorage.removeItem('mindflow_global_errors');
  }

  getStoredErrors(): AppError[] {
    try {
      return JSON.parse(localStorage.getItem('mindflow_global_errors') || '[]');
    } catch {
      return [];
    }
  }
}

// Global instance
export const globalErrorHandler = new GlobalErrorHandler();

// Setup default error handlers
globalErrorHandler.addHandler((error: Error | AppError) => {
  const appError = isAppError(error) ? error : classifyError(error);
  // Show user notification for high/critical errors
  if (appError.severity === 'high' || appError.severity === 'critical') {
    // TODO: Integrate with notification system
    console.log('Would show user notification for:', appError.message);
  }
});

// Setup global error listeners
if (typeof window !== 'undefined') {
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    globalErrorHandler.handle(event.reason, {
      type: 'unhandledRejection',
      url: window.location.href
    });
  });

  // Uncaught errors
  window.addEventListener('error', (event) => {
    globalErrorHandler.handle(event.error || event.message, {
      type: 'uncaughtError',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      url: window.location.href
    });
  });
}

// Export utilities
export {
  globalErrorHandler as errorHandler,
  GlobalErrorHandler
};