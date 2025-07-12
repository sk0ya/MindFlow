// 本番環境用のログレベル制御システム

// Type definitions
type LogLevel = number;
type LogLevelName = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'OFF';
type LogOutput = 'console' | 'storage' | 'remote';
type Environment = 'development' | 'production' | 'test';

interface LogEntry {
  timestamp: string;
  level: LogLevelName;
  levelNumber: LogLevel;
  message: string;
  meta: Record<string, unknown>;
  url: string;
  userAgent: string;
  sessionId: string;
  id: string;
}

interface LoggerOptions {
  level?: LogLevel;
  outputs?: LogOutput[];
  maxStorageEntries?: number;
  remoteEndpoint?: string | null;
  context?: Record<string, unknown>;
  filters?: Array<(_logEntry: LogEntry) => boolean>;
  formatter?: (_logEntry: LogEntry) => string;
  bufferSize?: number;
  flushInterval?: number;
}

interface LogFilter {
  level?: LogLevel;
  since?: string;
  until?: string;
  message?: string;
}

interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  lastHour: number;
  last24Hours: number;
}

// Extend Window interface for development utilities
declare global {
  interface Window {
    mindflowLogger?: Logger;
    logStats?: () => void;
    clearLogs?: () => void;
  }
}

// ログレベル定義
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
  OFF: 5
};

// ログレベル名
export const LOG_LEVEL_NAMES = {
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.ERROR]: 'ERROR',
  [LOG_LEVELS.FATAL]: 'FATAL',
  [LOG_LEVELS.OFF]: 'OFF'
};

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
};

// カスタムロガークラス
class Logger {
  public level: LogLevel;
  public enabledOutputs: LogOutput[];
  public maxStorageEntries: number;
  public remoteEndpoint: string | null;
  public context: Record<string, unknown>;
  public storageKey: string;
  public filters: Array<(_logEntry: LogEntry) => boolean>;
  public formatter: (_logEntry: LogEntry) => string;
  public logBuffer: LogEntry[];
  public bufferSize: number;
  public flushInterval: number;
  public remoteBuffer?: LogEntry[];

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || getDefaultLogLevel();
    this.enabledOutputs = options.outputs || [LOG_OUTPUTS.CONSOLE as LogOutput];
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
  createLogEntry(level: LogLevel, message: string, meta: Record<string, unknown> = {}): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_NAMES[level] as LogLevelName,
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
    
    // Local mode uses simple session ID generation
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
    // レベルチェック
    if (level < this.level) return;
    
    const logEntry = this.createLogEntry(level, message, meta);
    
    // フィルター適用
    if (!this.applyFilters(logEntry)) return;
    
    // 各出力先に送信
    this.enabledOutputs.forEach((output: LogOutput) => {
      this.outputToDestination(output, logEntry);
    });
    
    // バッファに追加
    this.addToBuffer(logEntry);
  }
  
  // 出力先別の処理
  outputToDestination(output: LogOutput, logEntry: LogEntry): void {
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
  outputToConsole(logEntry: LogEntry): void {
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
  getConsoleStyle(level: LogLevel): string {
    const styles = {
      [LOG_LEVELS.DEBUG]: 'color: #666; font-size: 11px;',
      [LOG_LEVELS.INFO]: 'color: #2196F3; font-weight: normal;',
      [LOG_LEVELS.WARN]: 'color: #FF9800; font-weight: bold;',
      [LOG_LEVELS.ERROR]: 'color: #F44336; font-weight: bold;',
      [LOG_LEVELS.FATAL]: 'color: #D32F2F; font-weight: bold; background: #FFEBEE;'
    };
    return styles[level] || styles[LOG_LEVELS.INFO];
  }
  
  // ローカルストレージ出力
  outputToStorage(logEntry: LogEntry): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const existingLogs = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      existingLogs.push(logEntry);
      
      // 最大エントリー数を超えた場合は古いものを削除
      if (existingLogs.length > this.maxStorageEntries) {
        existingLogs.splice(0, existingLogs.length - this.maxStorageEntries);
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(existingLogs));
    } catch (error) {
      console.warn('Failed to save log to localStorage:', error);
    }
  }
  
  // リモート出力
  outputToRemote(logEntry: LogEntry): void {
    if (!this.remoteEndpoint) return;
    
    // バッチ送信のためにバッファに追加
    this.addToRemoteBuffer(logEntry);
  }
  
  // バッファ管理
  addToBuffer(logEntry: LogEntry): void {
    this.logBuffer.push(logEntry);
    
    if (this.logBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }
  }
  
  // リモートバッファの管理
  addToRemoteBuffer(logEntry: LogEntry): void {
    if (!this.remoteBuffer) this.remoteBuffer = [];
    this.remoteBuffer.push(logEntry);
    
    // 即座に送信が必要なレベル
    if (logEntry.levelNumber >= LOG_LEVELS.ERROR) {
      this.flushRemoteBuffer();
    }
  }
  
  // バッファのフラッシュ
  flushBuffer(): void {
    if (this.logBuffer.length === 0) return;
    
    // ここでバッファのログに対して追加処理を実行可能
    this.logBuffer = [];
  }

  // リモートバッファのフラッシュ
  flushRemoteBuffer(): void {
    if (!this.remoteBuffer || this.remoteBuffer.length === 0) return;
    
    // リモートエンドポイントに送信する処理をここに実装
    this.remoteBuffer = [];
  }
  
  
  // 定期的なフラッシュ
  startPeriodicFlush(): void {
    if (typeof setInterval === 'undefined') return;
    
    setInterval(() => {
      this.flushBuffer();
    }, this.flushInterval);
  }
  
  // ストレージの初期化
  initializeStorage(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const existingLogs = localStorage.getItem(this.storageKey);
      if (!existingLogs) {
        localStorage.setItem(this.storageKey, '[]');
      }
    } catch (error) {
      console.warn('Failed to initialize log storage:', error);
    }
  }
  
  // 便利メソッド
  debug(message: string, meta?: Record<string, unknown>): void { this.log(LOG_LEVELS.DEBUG, message, meta); }
  info(message: string, meta?: Record<string, unknown>): void { this.log(LOG_LEVELS.INFO, message, meta); }
  warn(message: string, meta?: Record<string, unknown>): void { this.log(LOG_LEVELS.WARN, message, meta); }
  error(message: string, meta?: Record<string, unknown>): void { this.log(LOG_LEVELS.ERROR, message, meta); }
  fatal(message: string, meta?: Record<string, unknown>): void { this.log(LOG_LEVELS.FATAL, message, meta); }
  
  // ログの取得
  getLogs(filter: LogFilter = {}): LogEntry[] {
    if (typeof localStorage === 'undefined') return [];
    
    try {
      const logs = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      
      return logs.filter((log: LogEntry) => {
        if (filter.level && log.levelNumber < filter.level) return false;
        if (filter.since && new Date(log.timestamp) < new Date(filter.since)) return false;
        if (filter.until && new Date(log.timestamp) > new Date(filter.until)) return false;
        if (filter.message && !log.message.toLowerCase().includes(filter.message.toLowerCase())) return false;
        return true;
      });
    } catch (error) {
      console.warn('Failed to retrieve logs:', error);
      return [];
    }
  }
  
  // ログのクリア
  clearLogs(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      localStorage.setItem(this.storageKey, '[]');
      this.info('Logs cleared');
    } catch (error) {
      console.warn('Failed to clear logs:', error);
    }
  }
  
  // ログの統計
  getLogStats(): LogStats {
    const logs = this.getLogs();
    const stats = {
      total: logs.length,
      byLevel: {} as Record<LogLevelName, number>,
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
    ? [LOG_OUTPUTS.STORAGE as LogOutput]
    : [LOG_OUTPUTS.CONSOLE as LogOutput, LOG_OUTPUTS.STORAGE as LogOutput];
};

// グローバルロガーインスタンス
export const logger = new Logger({
  level: getDefaultLogLevel(),
  outputs: getLogOutputs(),
  // No remote endpoint for local mode
  context: {
    app: 'MindFlow',
    version: '1.0.0',
    environment: getEnvironment()
  }
});

// 便利な関数をエクスポート
export const debug = (message: string, meta?: Record<string, unknown>): void => logger.debug(message, meta);
export const info = (message: string, meta?: Record<string, unknown>): void => logger.info(message, meta);
export const warn = (message: string, meta?: Record<string, unknown>): void => logger.warn(message, meta);
export const error = (message: string, meta?: Record<string, unknown>): void => logger.error(message, meta);
export const fatal = (message: string, meta?: Record<string, unknown>): void => logger.fatal(message, meta);

// カスタムロガーの作成
export const createLogger = (options: LoggerOptions): Logger => new Logger(options);

// 一般的なフィルター
export const commonFilters = {
  // デバッグメッセージを除外
  excludeDebug: (logEntry: LogEntry): boolean => logEntry.levelNumber > LOG_LEVELS.DEBUG,
  
  // 特定のメッセージパターンを除外
  excludePattern: (pattern: RegExp) => (logEntry: LogEntry): boolean => !pattern.test(logEntry.message),
  
  // 特定のメタデータを持つログのみ通す
  includeMetaKey: (key: string) => (logEntry: LogEntry): boolean => key in logEntry.meta,
  
  // レート制限（同じメッセージを短時間で大量に出力しない）
  rateLimit: (windowMs = 60000, maxCount = 10) => {
    const messageLog = new Map<string, number[]>();
    
    return (logEntry: LogEntry): boolean => {
      const now = Date.now();
      const key = logEntry.message;
      
      if (!messageLog.has(key)) {
        messageLog.set(key, []);
      }
      
      const timestamps = messageLog.get(key) as number[];
      
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
    window.mindflowLogger = logger;
    window.logStats = () => console.table(logger.getLogStats());
    window.clearLogs = () => logger.clearLogs();
  }
}