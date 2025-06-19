// 包括的なエラーハンドリングユーティリティ

// エラーの種類
export const ERROR_TYPES = {
  STORAGE_ERROR: 'storage_error',
  NETWORK_ERROR: 'network_error',
  FILE_ERROR: 'file_error',
  VALIDATION_ERROR: 'validation_error',
  AUTHENTICATION_ERROR: 'auth_error',
  UNKNOWN_ERROR: 'unknown_error'
};

// エラーの重要度
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// カスタムエラークラス
export class MindFlowError extends Error {
  constructor(message, type = ERROR_TYPES.UNKNOWN_ERROR, severity = ERROR_SEVERITY.MEDIUM, context = {}) {
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
  constructor() {
    this.errors = [];
    this.maxErrors = 100;
    this.listeners = [];
  }

  log(error, context = {}) {
    const errorEntry = {
      id: error.errorId || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      type: error.type || ERROR_TYPES.UNKNOWN_ERROR,
      severity: error.severity || ERROR_SEVERITY.MEDIUM,
      stack: error.stack,
      context: { ...error.context, ...context },
      timestamp: error.timestamp || new Date().toISOString(),
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

    // LocalStorageに保存
    this.saveToStorage();

    return errorEntry;
  }

  logToConsole(errorEntry) {
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

  getConsoleStyle(severity) {
    const styles = {
      [ERROR_SEVERITY.LOW]: 'color: #f39c12; font-weight: bold;',
      [ERROR_SEVERITY.MEDIUM]: 'color: #e67e22; font-weight: bold;',
      [ERROR_SEVERITY.HIGH]: 'color: #e74c3c; font-weight: bold;',
      [ERROR_SEVERITY.CRITICAL]: 'color: #c0392b; font-weight: bold; background: #fff5f5;'
    };
    return styles[severity] || styles[ERROR_SEVERITY.MEDIUM];
  }

  saveToStorage() {
    try {
      localStorage.setItem('mindflow_error_log', JSON.stringify(this.errors.slice(-50)));
    } catch (error) {
      console.warn('Failed to save errors to localStorage:', error);
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('mindflow_error_log');
      if (stored) {
        this.errors = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load errors from localStorage:', error);
    }
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  getErrors(filter = {}) {
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

    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  clear() {
    this.errors = [];
    this.saveToStorage();
  }

  getStats() {
    const total = this.errors.length;
    const byType = {};
    const bySeverity = {};
    
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
export const getUserFriendlyMessage = (error) => {
  const messages = {
    [ERROR_TYPES.STORAGE_ERROR]: 'データの保存中にエラーが発生しました。ブラウザの容量を確認してください。',
    [ERROR_TYPES.NETWORK_ERROR]: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
    [ERROR_TYPES.FILE_ERROR]: 'ファイルの処理中にエラーが発生しました。ファイル形式やサイズを確認してください。',
    [ERROR_TYPES.VALIDATION_ERROR]: '入力内容に問題があります。値を確認して再度お試しください。',
    [ERROR_TYPES.AUTHENTICATION_ERROR]: '認証に問題があります。ログインし直してください。',
    [ERROR_TYPES.UNKNOWN_ERROR]: '予期しないエラーが発生しました。ページを再読み込みしてお試しください。'
  };

  return messages[error.type] || messages[ERROR_TYPES.UNKNOWN_ERROR];
};

// エラーハンドリングのヘルパー関数
export const handleError = (error, context = {}, options = {}) => {
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
const showErrorNotification = (error) => {
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
  window.addEventListener('unhandledrejection', (event) => {
    handleError(new MindFlowError(
      event.reason?.message || 'Unhandled promise rejection',
      ERROR_TYPES.UNKNOWN_ERROR,
      ERROR_SEVERITY.HIGH,
      {
        reason: event.reason
      }
    ));
  });

  // Storage quota exceeded
  window.addEventListener('storage', (event) => {
    if (event.error) {
      handleError(new MindFlowError(
        'Storage error occurred',
        ERROR_TYPES.STORAGE_ERROR,
        ERROR_SEVERITY.MEDIUM
      ));
    }
  });
};

// エラー回復のヘルパー
export const withErrorRecovery = async (fn, options = {}) => {
  const { maxRetries = 3, delay = 1000, onRetry } = options;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        handleError(error, { 
          maxRetries, 
          attempts: attempt,
          recoveryFailed: true 
        });
        throw error;
      }

      if (onRetry) {
        onRetry(error, attempt);
      }

      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
};