/**
 * Comprehensive logging system for MindFlow
 * Replaces debug console statements with structured logging
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  context?: {
    component?: string;
    function?: string;
    userId?: string;
    sessionId?: string;
    userAgent?: string;
    url?: string;
  };
  stack?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  enableRemote: boolean;
  maxStorageEntries: number;
  remoteEndpoint?: string;
  categories: {
    [category: string]: {
      level: LogLevel;
      enabled: boolean;
    };
  };
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableStorage: true,
  enableRemote: false,
  maxStorageEntries: 100,
  categories: {
    auth: { level: LogLevel.INFO, enabled: true },
    api: { level: LogLevel.INFO, enabled: true },
    ui: { level: LogLevel.WARN, enabled: true },
    performance: { level: LogLevel.INFO, enabled: true },
    data: { level: LogLevel.INFO, enabled: true },
    error: { level: LogLevel.ERROR, enabled: true },
    debug: { level: LogLevel.DEBUG, enabled: process.env.NODE_ENV === 'development' }
  }
};

class Logger {
  private config: LoggerConfig;
  private sessionId: string;
  private logBuffer: LogEntry[] = [];
  private readonly STORAGE_KEY = 'mindflow_logs';

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
    
    // Initialize from stored config
    this.loadConfig();
  }

  private generateSessionId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem('mindflow_logger_config');
      if (stored) {
        const storedConfig = JSON.parse(stored);
        this.config = { ...this.config, ...storedConfig };
      }
    } catch (error) {
      console.warn('Failed to load logger config:', error);
    }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem('mindflow_logger_config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save logger config:', error);
    }
  }

  private shouldLog(level: LogLevel, category: string): boolean {
    const categoryConfig = this.config.categories[category];
    
    if (!categoryConfig?.enabled) {
      return false;
    }

    return level >= Math.max(this.config.level, categoryConfig.level);
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const levelName = LogLevel[entry.level];
    const prefix = `[${timestamp}] ${levelName} [${entry.category.toUpperCase()}]`;
    
    if (entry.context?.component) {
      return `${prefix} (${entry.context.component}) ${entry.message}`;
    }
    
    return `${prefix} ${entry.message}`;
  }

  private getContextualInfo(): LogEntry['context'] {
    return {
      userId: this.getCurrentUserId(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
  }

  private getCurrentUserId(): string {
    try {
      const userStr = sessionStorage.getItem('auth_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.id || 'anonymous';
      }
    } catch {
      // Ignore errors
    }
    return 'anonymous';
  }

  private createLogEntry(
    level: LogLevel,
    category: string,
    message: string,
    data?: any,
    context?: Partial<LogEntry['context']>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      context: { ...this.getContextualInfo(), ...context },
      stack: level >= LogLevel.ERROR ? new Error().stack : undefined
    };
  }

  private outputToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const message = this.formatMessage(entry);
    const style = this.getConsoleStyle(entry.level);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`%c${message}`, style, entry.data);
        break;
      case LogLevel.INFO:
        console.info(`%c${message}`, style, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(`%c${message}`, style, entry.data);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(`%c${message}`, style, entry.data);
        if (entry.stack) {
          console.error('Stack trace:', entry.stack);
        }
        break;
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    const styles = {
      [LogLevel.DEBUG]: 'color: #666; font-size: 11px;',
      [LogLevel.INFO]: 'color: #2196F3; font-weight: bold;',
      [LogLevel.WARN]: 'color: #FF9800; font-weight: bold;',
      [LogLevel.ERROR]: 'color: #F44336; font-weight: bold;',
      [LogLevel.CRITICAL]: 'color: #D32F2F; font-weight: bold; background: #ffebee; padding: 2px 4px;'
    };
    return styles[level] || '';
  }

  private storeLog(entry: LogEntry): void {
    if (!this.config.enableStorage) return;

    try {
      this.logBuffer.push(entry);
      
      // Maintain buffer size
      if (this.logBuffer.length > this.config.maxStorageEntries) {
        this.logBuffer = this.logBuffer.slice(-this.config.maxStorageEntries);
      }

      // Persist to localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.logBuffer));
    } catch (error) {
      console.warn('Failed to store log entry:', error);
    }
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.enableRemote || !this.config.remoteEndpoint) return;

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      console.warn('Failed to send log to remote endpoint:', error);
    }
  }

  // Public logging methods
  public log(level: LogLevel, category: string, message: string, data?: any, context?: Partial<LogEntry['context']>): void {
    if (!this.shouldLog(level, category)) return;

    const entry = this.createLogEntry(level, category, message, data, context);

    this.outputToConsole(entry);
    this.storeLog(entry);

    if (this.config.enableRemote) {
      this.sendToRemote(entry);
    }
  }

  public debug(category: string, message: string, data?: any, context?: Partial<LogEntry['context']>): void {
    this.log(LogLevel.DEBUG, category, message, data, context);
  }

  public info(category: string, message: string, data?: any, context?: Partial<LogEntry['context']>): void {
    this.log(LogLevel.INFO, category, message, data, context);
  }

  public warn(category: string, message: string, data?: any, context?: Partial<LogEntry['context']>): void {
    this.log(LogLevel.WARN, category, message, data, context);
  }

  public error(category: string, message: string, data?: any, context?: Partial<LogEntry['context']>): void {
    this.log(LogLevel.ERROR, category, message, data, context);
  }

  public critical(category: string, message: string, data?: any, context?: Partial<LogEntry['context']>): void {
    this.log(LogLevel.CRITICAL, category, message, data, context);
  }

  // Specialized logging methods
  public api(method: string, url: string, status?: number, duration?: number, data?: any): void {
    this.info('api', `${method} ${url}`, {
      method,
      url,
      status,
      duration,
      ...data
    });
  }

  public auth(action: string, success: boolean, details?: any): void {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    this.log(level, 'auth', `Auth ${action}: ${success ? 'success' : 'failed'}`, details);
  }

  public performance(metric: string, value: number, unit: string = 'ms', data?: any): void {
    this.info('performance', `${metric}: ${value}${unit}`, {
      metric,
      value,
      unit,
      ...data
    });
  }

  public ui(component: string, action: string, data?: any): void {
    this.debug('ui', `${component}: ${action}`, data, { component });
  }

  public data(operation: string, result: 'success' | 'error', details?: any): void {
    const level = result === 'success' ? LogLevel.INFO : LogLevel.ERROR;
    this.log(level, 'data', `Data ${operation}: ${result}`, details);
  }

  // Configuration methods
  public setLevel(level: LogLevel): void {
    this.config.level = level;
    this.saveConfig();
  }

  public setCategoryLevel(category: string, level: LogLevel): void {
    if (this.config.categories[category]) {
      this.config.categories[category].level = level;
      this.saveConfig();
    }
  }

  public enableCategory(category: string, enabled: boolean = true): void {
    if (this.config.categories[category]) {
      this.config.categories[category].enabled = enabled;
      this.saveConfig();
    }
  }

  public enableRemoteLogging(endpoint: string): void {
    this.config.enableRemote = true;
    this.config.remoteEndpoint = endpoint;
    this.saveConfig();
  }

  public disableRemoteLogging(): void {
    this.config.enableRemote = false;
    this.saveConfig();
  }

  // Utility methods
  public getLogs(category?: string, level?: LogLevel): LogEntry[] {
    let logs = [...this.logBuffer];

    if (category) {
      logs = logs.filter(log => log.category === category);
    }

    if (level !== undefined) {
      logs = logs.filter(log => log.level >= level);
    }

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public clearLogs(): void {
    this.logBuffer = [];
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear stored logs:', error);
    }
  }

  public exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }

  public getConfig(): LoggerConfig {
    return { ...this.config };
  }

  public getSessionId(): string {
    return this.sessionId;
  }
}

// Global logger instance
export const logger = new Logger();

// Development helpers
if (process.env.NODE_ENV === 'development') {
  // Expose logger globally for debugging
  (window as any).mindflowLogger = logger;
  
  // Log initialization
  logger.info('debug', 'Logger initialized', {
    sessionId: logger.getSessionId(),
    config: logger.getConfig()
  });
}

export default logger;