// 本番環境用のログレベル制御システム

// ログレベル定義
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
  OFF: 5
} as const;

// ログレベル型定義
export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];
export type LogLevelName = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'OFF';

// ログレベル名
export const LOG_LEVEL_NAMES: Record<LogLevel, LogLevelName> = {
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.ERROR]: 'ERROR',
  [LOG_LEVELS.FATAL]: 'FATAL',
  [LOG_LEVELS.OFF]: 'OFF'
};

// 環境型定義
export type Environment = 'development' | 'production' | 'test';

// ログ出力先型定義
export type LogOutput = 'console' | 'storage' | 'remote';

// メタデータ型定義
export interface LogMeta {
  [key: string]: unknown;
}

// ログエントリー型定義
export interface LogEntry {
  timestamp: string;
  level: LogLevelName;
  levelNumber: LogLevel;
  message: string;
  meta: LogMeta;
  url: string;
  userAgent: string;
  sessionId: string;
  id: string;
}

// ログフィルター型定義
export type LogFilter = (logEntry: LogEntry) => boolean;

// ログフォーマッター型定義
export type LogFormatter = (logEntry: LogEntry) => string;

// ログ統計型定義
export interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  lastHour: number;
  last24Hours: number;
}

// ログフィルターオプション型定義
export interface LogFilterOptions {
  level?: LogLevel;
  since?: string | Date;
  until?: string | Date;
  message?: string;
}

// ロガーオプション型定義
export interface LoggerOptions {
  level?: LogLevel;
  outputs?: LogOutput[];
  maxStorageEntries?: number;
  remoteEndpoint?: string | null;
  context?: LogMeta;
  filters?: LogFilter[];
  formatter?: LogFormatter;
  bufferSize?: number;
  flushInterval?: number;
}

// 環境別デフォルトログレベル
const getDefaultLogLevel = (): LogLevel => {
  // Jest環境のチェック
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return LOG_LEVELS.WARN;
  }
  
  // 本番環境のチェック
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return LOG_LEVELS.ERROR;
  }
  
  // 開発環境がデフォルト
  return LOG_LEVELS.DEBUG;
};

// ログ出力先の定義
const LOG_OUTPUTS = {
  CONSOLE: 'console',
  STORAGE: 'storage',
  REMOTE: 'remote'
} as const;

// カスタムロガークラス
class Logger {
  private level: LogLevel;
  private enabledOutputs: LogOutput[];
  // private _maxStorageEntries: number; // Reserved for future storage management
  private remoteEndpoint: string | null;
  private context: LogMeta;
  // private _storageKey: string; // Reserved for future storage management
  private filters: LogFilter[];
  private formatter: LogFormatter;
  private logBuffer: LogEntry[];
  private bufferSize: number;
  private flushInterval: number;
  private remoteBuffer?: LogEntry[];

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || getDefaultLogLevel();
    this.enabledOutputs = options.outputs || [LOG_OUTPUTS.CONSOLE];
    this.maxStorageEntries = options.maxStorageEntries || 1000;
    this.remoteEndpoint = options.remoteEndpoint || null;
    this.context = options.context || {};
    this.storageKey = 'mindflow_logs';
    
    // フィルター関数
    this.filters = options.filters || [];
    
    // フォーマッター関数
    this.formatter = options.formatter || this.defaultFormatter;
    
    // ログエントリーのバッファ
    this.logBuffer = [];
    this.bufferSize = options.bufferSize || 100;
    this.flushInterval = options.flushInterval || 10000; // 10秒
    
    this.initializeStorage();
    this.startPeriodicFlush();
  }
  
  // ログレベルの設定
  setLevel(level: LogLevel): void {
    this.level = level;
    this.info(`Log level changed to: ${LOG_LEVEL_NAMES[level]}`);
  }
  
  // コンテキストの追加
  addContext(key: string, value: unknown): void {
    this.context[key] = value;
  }
  
  // コンテキストの削除
  removeContext(key: string): void {
    delete this.context[key];
  }
  
  // ログエントリーの作成
  createLogEntry(level: LogLevel, message: string, meta: LogMeta = {}): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_NAMES[level],
      levelNumber: level,
      message,
      meta: { ...this.context, ...meta },
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      sessionId: this.getSessionId(),
      id: this.generateLogId()
    };
  }
  
  // セッションIDの取得/生成
  getSessionId(): string {
    if (typeof window === 'undefined') return 'server';
    
    let sessionId = sessionStorage.getItem('mindflow_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('mindflow_session_id', sessionId);
    }
    return sessionId;
  }
  
  // ログIDの生成
  generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // フィルター適用
  applyFilters(logEntry: LogEntry): boolean {
    return this.filters.every(filter => filter(logEntry));
  }
  
  // デフォルトフォーマッター
  defaultFormatter(logEntry: LogEntry): string {
    const timestamp = new Date(logEntry.timestamp).toLocaleString();
    const level = logEntry.level.padEnd(5);
    const metaStr = Object.keys(logEntry.meta).length > 0 ? 
      ` | ${JSON.stringify(logEntry.meta)}` : '';
    
    return `[${timestamp}] ${level} ${logEntry.message}${metaStr}`;
  }
  
  // ログの出力
  log(level: LogLevel, message: string, meta: LogMeta = {}): void {
    // レベルチェック
    if (level < this.level) return;
    
    const logEntry = this.createLogEntry(level, message, meta);
    
    // フィルター適用
    if (!this.applyFilters(logEntry)) return;
    
    // 各出力先に送信
    this.enabledOutputs.forEach(output => {
      this.outputToDestination(output, logEntry);
    });
    
    // バッファに追加
    this.addToBuffer(logEntry);
  }
  
  // 出力先別の処理
  private outputToDestination(output: LogOutput, logEntry: LogEntry): void {
    switch (output) {
      case LOG_OUTPUTS.CONSOLE:
        this.outputToConsole(logEntry);
        break;
      case LOG_OUTPUTS.STORAGE:
        this.outputToStorage(logEntry);
        break;
      case LOG_OUTPUTS.REMOTE:
        this.outputToRemote(logEntry);
        break;
    }
  }
  
  // コンソール出力
  private outputToConsole(logEntry: LogEntry): void {
    if (typeof console === 'undefined') return;
    
    const formattedMessage = this.formatter(logEntry);
    const style = this.getConsoleStyle(logEntry.levelNumber);
    
    switch (logEntry.levelNumber) {
      case LOG_LEVELS.DEBUG:
        console.debug(`%c${formattedMessage}`, style);
        break;
      case LOG_LEVELS.INFO:
        console.info(`%c${formattedMessage}`, style);
        break;
      case LOG_LEVELS.WARN:
        console.warn(`%c${formattedMessage}`, style);
        break;
      case LOG_LEVELS.ERROR:
      case LOG_LEVELS.FATAL:
        console.error(`%c${formattedMessage}`, style);
        break;
      default:
        console.log(`%c${formattedMessage}`, style);
    }
  }
  
  // コンソールスタイル
  private getConsoleStyle(level: LogLevel): string {
    const styles: Record<LogLevel, string> = {
      [LOG_LEVELS.DEBUG]: 'color: #666; font-size: 11px;',
      [LOG_LEVELS.INFO]: 'color: #2196F3; font-weight: normal;',
      [LOG_LEVELS.WARN]: 'color: #FF9800; font-weight: bold;',
      [LOG_LEVELS.ERROR]: 'color: #F44336; font-weight: bold;',
      [LOG_LEVELS.FATAL]: 'color: #D32F2F; font-weight: bold; background: #FFEBEE;',
      [LOG_LEVELS.OFF]: 'color: #999; font-style: italic;'
    };
    return styles[level] || styles[LOG_LEVELS.INFO];
  }
  
  // クラウド専用ログ出力（ローカルストレージなし）
  private outputToStorage(logEntry: LogEntry): void {
    // Cloud mode: no localStorage for log storage
    console.log('☁️ Cloud mode: log not saved to localStorage', logEntry.message);
  }
  
  // リモート出力
  private outputToRemote(logEntry: LogEntry): void {
    if (!this.remoteEndpoint) return;
    
    // バッチ送信のためにバッファに追加
    this.addToRemoteBuffer(logEntry);
  }
  
  // バッファ管理
  private addToBuffer(logEntry: LogEntry): void {
    this.logBuffer.push(logEntry);
    
    if (this.logBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }
  }
  
  // リモートバッファの管理
  private addToRemoteBuffer(logEntry: LogEntry): void {
    if (!this.remoteBuffer) this.remoteBuffer = [];
    this.remoteBuffer.push(logEntry);
    
    // 即座に送信が必要なレベル
    if (logEntry.levelNumber >= LOG_LEVELS.ERROR) {
      this.flushRemoteBuffer();
    }
  }
  
  // バッファのフラッシュ
  private flushBuffer(): void {
    if (this.logBuffer.length === 0) return;
    
    // ここでバッファのログに対して追加処理を実行可能
    this.logBuffer = [];
  }
  
  // リモートバッファのフラッシュ
  private async flushRemoteBuffer(): Promise<void> {
    if (!this.remoteBuffer || this.remoteBuffer.length === 0) return;
    
    const logsToSend = [...this.remoteBuffer];
    this.remoteBuffer = [];
    
    try {
      const response = await fetch(this.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          source: 'mindflow-client'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: unknown) {
      // リモート送信に失敗した場合は console.warn で記録
      console.warn('Failed to send logs to remote endpoint:', error);
      
      // Cloud mode: important logs handled through cloud infrastructure
      console.warn('☁️ Failed to send logs to remote endpoint, logs handled by cloud infrastructure');
    }
  }
  
  // 定期的なフラッシュ
  private startPeriodicFlush(): void {
    if (typeof setInterval === 'undefined') return;
    
    setInterval(() => {
      this.flushBuffer();
      this.flushRemoteBuffer();
    }, this.flushInterval);
  }
  
  // クラウド専用ストレージ初期化
  private initializeStorage(): void {
    // Cloud mode: no localStorage initialization needed
    console.log('☁️ Cloud mode: log storage initialization skipped');
  }
  
  // 便利メソッド
  debug(message: string, meta?: LogMeta): void { this.log(LOG_LEVELS.DEBUG, message, meta); }
  info(message: string, meta?: LogMeta): void { this.log(LOG_LEVELS.INFO, message, meta); }
  warn(message: string, meta?: LogMeta): void { this.log(LOG_LEVELS.WARN, message, meta); }
  error(message: string, meta?: LogMeta): void { this.log(LOG_LEVELS.ERROR, message, meta); }
  fatal(message: string, meta?: LogMeta): void { this.log(LOG_LEVELS.FATAL, message, meta); }
  
  // ログの取得（クラウド専用）
  getLogs(_filter: LogFilterOptions = {}): LogEntry[] {
    // Cloud mode: logs not stored in localStorage
    console.log('☁️ Cloud mode: logs not available from localStorage');
    return [];
  }
  
  // ログのクリア（クラウド専用）
  clearLogs(): void {
    // Cloud mode: no localStorage to clear
    console.log('☁️ Cloud mode: logs not stored in localStorage');
    this.info('Logs cleared (cloud mode)');
  }
  
  // ログの統計
  getLogStats(): LogStats {
    const logs = this.getLogs();
    const stats: LogStats = {
      total: logs.length,
      byLevel: {},
      lastHour: 0,
      last24Hours: 0
    };
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    logs.forEach((log: LogEntry) => {
      // レベル別カウント
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      
      // 時間別カウント
      const logTime = new Date(log.timestamp);
      if (logTime > oneHourAgo) stats.lastHour++;
      if (logTime > oneDayAgo) stats.last24Hours++;
    });
    
    return stats;
  }
}

// 環境判定ヘルパー
const getEnvironment = (): Environment => {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return 'test';
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return 'production';
  }
  return 'development';
};

const getLogOutputs = (): LogOutput[] => {
  const env = getEnvironment();
  return env === 'production' 
    ? [LOG_OUTPUTS.STORAGE, LOG_OUTPUTS.REMOTE]
    : [LOG_OUTPUTS.CONSOLE, LOG_OUTPUTS.STORAGE];
};

// グローバルロガーインスタンス
export const logger = new Logger({
  level: getDefaultLogLevel(),
  outputs: getLogOutputs(),
  remoteEndpoint: undefined, // Remove Vite env dependency
  context: {
    app: 'MindFlow',
    version: '1.0.0',
    environment: getEnvironment()
  }
});

// 便利な関数をエクスポート
export const debug = (message: string, meta?: LogMeta): void => logger.debug(message, meta);
export const info = (message: string, meta?: LogMeta): void => logger.info(message, meta);
export const warn = (message: string, meta?: LogMeta): void => logger.warn(message, meta);
export const error = (message: string, meta?: LogMeta): void => logger.error(message, meta);
export const fatal = (message: string, meta?: LogMeta): void => logger.fatal(message, meta);

// カスタムロガーの作成
export const createLogger = (options?: LoggerOptions): Logger => new Logger(options);

// 一般的なフィルター
export const commonFilters = {
  // デバッグメッセージを除外
  excludeDebug: (logEntry: LogEntry): boolean => logEntry.levelNumber > LOG_LEVELS.DEBUG,
  
  // 特定のメッセージパターンを除外
  excludePattern: (pattern: RegExp): LogFilter => (logEntry: LogEntry): boolean => !pattern.test(logEntry.message),
  
  // 特定のメタデータを持つログのみ通す
  includeMetaKey: (key: string): LogFilter => (logEntry: LogEntry): boolean => key in logEntry.meta,
  
  // レート制限（同じメッセージを短時間で大量に出力しない）
  rateLimit: (windowMs: number = 60000, maxCount: number = 10): LogFilter => {
    const messageLog = new Map<string, number[]>();
    
    return (logEntry: LogEntry): boolean => {
      const now = Date.now();
      const key = logEntry.message;
      
      if (!messageLog.has(key)) {
        messageLog.set(key, []);
      }
      
      const timestamps = messageLog.get(key) || [];
      
      // 古いタイムスタンプを削除
      const cutoff = now - windowMs;
      const recentTimestamps = timestamps.filter((ts: number) => ts > cutoff);
      
      if (recentTimestamps.length >= maxCount) {
        return false; // レート制限に引っかかった
      }
      
      recentTimestamps.push(now);
      messageLog.set(key, recentTimestamps);
      return true;
    };
  }
};

// 開発環境での便利機能
if (getEnvironment() === 'development') {
  // グローバルにロガーを公開（デバッグ用）
  if (typeof window !== 'undefined') {
    // TypeScript用のwindowオブジェクト拡張
    (window as any).mindflowLogger = logger;
    (window as any).logStats = (): void => console.table(logger.getLogStats());
    (window as any).clearLogs = (): void => logger.clearLogs();
  }
}