// 包括的なエラーハンドリングユーティリティ

// エラーの種類
export const ERROR_TYPES = {
  STORAGE_ERROR: 'storage_error',
  NETWORK_ERROR: 'network_error',
  FILE_ERROR: 'file_error',
  VALIDATION_ERROR: 'validation_error',
  AUTHENTICATION_ERROR: 'auth_error',
  UNKNOWN_ERROR: 'unknown_error'
} as const;

// エラーの重要度
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

// Type definitions
export type ErrorType = typeof ERROR_TYPES[keyof typeof ERROR_TYPES];
export type ErrorSeverity = typeof ERROR_SEVERITY[keyof typeof ERROR_SEVERITY];

// エラーコンテキスト
export interface ErrorContext {
  [key: string]: unknown;
  filename?: string;
  lineno?: number;
  colno?: number;
  reason?: unknown;
  maxRetries?: number;
  attempts?: number;
  recoveryFailed?: boolean;
}

// エラーエントリ
export interface ErrorEntry {
  id: string;
  message: string;
  type: ErrorType;
  severity: ErrorSeverity;
  stack?: string;
  context: ErrorContext;
  timestamp: string;
  userAgent: string;
  url: string;
}

// エラーフィルター
export interface ErrorFilter {
  type?: ErrorType;
  severity?: ErrorSeverity;
  since?: string | Date;
}

// エラー統計
export interface ErrorStats {
  total: number;
  byType: Record<ErrorType, number>;
  bySeverity: Record<ErrorSeverity, number>;
}

// エラーハンドリングオプション
export interface ErrorHandlingOptions {
  type?: ErrorType;
  severity?: ErrorSeverity;
  notify?: boolean;
}

// エラー回復オプション
export interface ErrorRecoveryOptions {
  maxRetries?: number;
  delay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

// フォーカスオプション
export interface FocusOptions {
  announcement?: string;
  preventScroll?: boolean;
}

// カスタムエラークラス
export class MindFlowError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly timestamp: string;
  public readonly errorId: string;

  constructor(
    message: string,
    type: ErrorType = ERROR_TYPES.UNKNOWN_ERROR,
    severity: ErrorSeverity = ERROR_SEVERITY.MEDIUM,
    context: ErrorContext = {}
  ) {
    super(message);
    this.name = 'MindFlowError';
    this.type = type;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.errorId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// エラーログ管理
class ErrorLogger {
  private errors: ErrorEntry[] = [];
  private readonly maxErrors: number = 100;
  private listeners: Array<(errorEntry: ErrorEntry) => void> = [];

  log(error: Error | MindFlowError, context: ErrorContext = {}): ErrorEntry {
    const errorEntry: ErrorEntry = {
      id: (error as MindFlowError).errorId || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      type: (error as MindFlowError).type || ERROR_TYPES.UNKNOWN_ERROR,
      severity: (error as MindFlowError).severity || ERROR_SEVERITY.MEDIUM,
      stack: error.stack,
      context: { ...(error as MindFlowError).context, ...context },
      timestamp: (error as MindFlowError).timestamp || new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.errors.push(errorEntry);
    
    // 最大件数を超えた場合は古いものを削除
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // リスナーに通知
    this.listeners.forEach(listener => {
      try {
        listener(errorEntry);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });

    // コンソールに出力
    this.logToConsole(errorEntry);

    // Cloud mode: errors logged to console only

    return errorEntry;
  }

  private logToConsole(errorEntry: ErrorEntry): void {
    const style = this.getConsoleStyle(errorEntry.severity);
    
    console.group(`%c🚨 MindFlow Error [${errorEntry.severity.toUpperCase()}]`, style);
    console.error('Message:', errorEntry.message);
    console.error('Type:', errorEntry.type);
    console.error('ID:', errorEntry.id);
    console.error('Context:', errorEntry.context);
    if (errorEntry.stack) {
      console.error('Stack:', errorEntry.stack);
    }
    console.groupEnd();
  }

  private getConsoleStyle(severity: ErrorSeverity): string {
    const styles = {
      [ERROR_SEVERITY.LOW]: 'color: #f39c12; font-weight: bold;',
      [ERROR_SEVERITY.MEDIUM]: 'color: #e67e22; font-weight: bold;',
      [ERROR_SEVERITY.HIGH]: 'color: #e74c3c; font-weight: bold;',
      [ERROR_SEVERITY.CRITICAL]: 'color: #c0392b; font-weight: bold; background: #fff5f5;'
    };
    return styles[severity] || styles[ERROR_SEVERITY.MEDIUM];
  }

  private saveToStorage(): void {
    // Cloud mode: no localStorage for error storage
    console.log('☁️ Cloud mode: errors not saved to localStorage');
  }

  public loadFromStorage(): void {
    // Cloud mode: no localStorage for error storage
    console.log('☁️ Cloud mode: errors not loaded from localStorage');
  }

  public addListener(listener: (errorEntry: ErrorEntry) => void): void {
    this.listeners.push(listener);
  }

  public removeListener(listener: (errorEntry: ErrorEntry) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  public getErrors(filter: ErrorFilter = {}): ErrorEntry[] {
    let filtered = this.errors;

    if (filter.type) {
      filtered = filtered.filter(error => error.type === filter.type);
    }

    if (filter.severity) {
      filtered = filtered.filter(error => error.severity === filter.severity);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      filtered = filtered.filter(error => new Date(error.timestamp) >= since);
    }

    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public clear(): void {
    this.errors = [];
    this.saveToStorage();
  }

  public getStats(): ErrorStats {
    const total = this.errors.length;
    const byType = {} as Record<ErrorType, number>;
    const bySeverity = {} as Record<ErrorSeverity, number>;
    
    this.errors.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    });

    return { total, byType, bySeverity };
  }
}

// グローバルエラーロガーのインスタンス
export const errorLogger = new ErrorLogger();

// 初期化時にStorageからロード
errorLogger.loadFromStorage();

// ユーザーフレンドリーなエラーメッセージの生成
export const getUserFriendlyMessage = (error: MindFlowError | Error): string => {
  const messages: Record<ErrorType, string> = {
    [ERROR_TYPES.STORAGE_ERROR]: 'データの保存中にエラーが発生しました。ブラウザの容量を確認してください。',
    [ERROR_TYPES.NETWORK_ERROR]: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
    [ERROR_TYPES.FILE_ERROR]: 'ファイルの処理中にエラーが発生しました。ファイル形式やサイズを確認してください。',
    [ERROR_TYPES.VALIDATION_ERROR]: '入力内容に問題があります。値を確認して再度お試しください。',
    [ERROR_TYPES.AUTHENTICATION_ERROR]: '認証に問題があります。ログインし直してください。',
    [ERROR_TYPES.UNKNOWN_ERROR]: '予期しないエラーが発生しました。ページを再読み込みしてお試しください。'
  };

  const errorType = (error as MindFlowError).type || ERROR_TYPES.UNKNOWN_ERROR;
  return messages[errorType] || messages[ERROR_TYPES.UNKNOWN_ERROR];
};

// エラーハンドリングのヘルパー関数
export const handleError = (
  error: Error | MindFlowError,
  context: ErrorContext = {},
  options: ErrorHandlingOptions = {}
): ErrorEntry => {
  // MindFlowErrorでない場合は変換
  let mindFlowError;
  if (error instanceof MindFlowError) {
    mindFlowError = error;
  } else {
    mindFlowError = new MindFlowError(
      error.message || 'Unknown error',
      options.type || ERROR_TYPES.UNKNOWN_ERROR,
      options.severity || ERROR_SEVERITY.MEDIUM,
      context
    );
  }

  // ログに記録
  const errorEntry = errorLogger.log(mindFlowError, context);

  // ユーザー通知が必要な場合
  if (options.notify !== false && mindFlowError.severity !== ERROR_SEVERITY.LOW) {
    showErrorNotification(mindFlowError);
  }

  // カスタムイベントを発火
  window.dispatchEvent(new CustomEvent('mindflow-error', {
    detail: errorEntry
  }));

  return errorEntry;
};

// エラー通知の表示
const showErrorNotification = (error: MindFlowError): void => {
  const message = getUserFriendlyMessage(error);
  
  // ブラウザのnotification APIが利用可能な場合
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('MindFlow エラー', {
      body: message,
      icon: '/favicon.ico'
    });
  } else {
    // フォールバック: コンソール出力
    console.warn('User notification:', message);
  }
};

// グローバルエラーハンドラーの設定
export const setupGlobalErrorHandling = () => {
  // Uncaught JavaScript errors
  window.addEventListener('error', (event) => {
    handleError(new MindFlowError(
      event.message,
      ERROR_TYPES.UNKNOWN_ERROR,
      ERROR_SEVERITY.HIGH,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    ));
  });

  // Unhandled Promise rejections
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = (reason instanceof Error) ? reason.message : 'Unhandled promise rejection';
    handleError(new MindFlowError(
      message,
      ERROR_TYPES.UNKNOWN_ERROR,
      ERROR_SEVERITY.HIGH,
      {
        reason: reason
      }
    ));
  });

  // Storage quota exceeded
  window.addEventListener('storage', (event: StorageEvent) => {
    // Note: StorageEvent doesn't have an error property in standard API
    // This is a conceptual event handler for storage-related errors
    if ('error' in event && (event as any).error) {
      handleError(new MindFlowError(
        'Storage error occurred',
        ERROR_TYPES.STORAGE_ERROR,
        ERROR_SEVERITY.MEDIUM
      ));
    }
  });
};

// エラー回復のヘルパー
export const withErrorRecovery = async <T>(
  fn: () => Promise<T>,
  options: ErrorRecoveryOptions = {}
): Promise<T> => {
  const { maxRetries = 3, delay = 1000, onRetry } = options;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        handleError(error as Error, { 
          maxRetries, 
          attempts: attempt,
          recoveryFailed: true 
        });
        throw error;
      }

      if (onRetry) {
        onRetry(error as Error, attempt);
      }

      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  // This line should never be reached, but TypeScript requires it
  throw new Error('withErrorRecovery: Unexpected error');
};