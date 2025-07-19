export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

interface LoggerConfig {
  level: LogLevel;
  isDevelopment: boolean;
}

class Logger {
  private config: LoggerConfig;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 4,
  };

  constructor() {
    const isDevelopment = import.meta.env.DEV;
    const configuredLevel = (import.meta.env.VITE_LOG_LEVEL || (isDevelopment ? 'debug' : 'error')) as LogLevel;
    
    this.config = {
      level: configuredLevel,
      isDevelopment,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.config.level];
  }

  private maskSensitiveData(data: unknown): unknown {
    if (typeof data === 'string') {
      // Mask JWT tokens
      let maskedData = data.replace(/Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi, 'Bearer [MASKED]');
      // Mask tokens in URLs
      maskedData = maskedData.replace(/(\?|&)token=[\w-]+/gi, '$1token=[MASKED]');
      // Mask API keys
      maskedData = maskedData.replace(/([aA]pi[_-]?[kK]ey|apikey)[:=]\s*[\w-]+/gi, '$1=[MASKED]');
      // Mask authorization headers
      maskedData = maskedData.replace(/(authorization|x-api-key):\s*[\w-]+/gi, '$1: [MASKED]');
      return maskedData;
    } else if (typeof data === 'object' && data !== null) {
      const masked = Array.isArray(data) ? [...data] as unknown[] : { ...data as Record<string, unknown> };
      
      if (Array.isArray(masked)) {
        return masked.map(item => this.maskSensitiveData(item));
      }
      
      const maskedRecord = masked as Record<string, unknown>;
      for (const key in maskedRecord) {
        if (key.toLowerCase().includes('token') || 
            key.toLowerCase().includes('auth') || 
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('secret')) {
          maskedRecord[key] = '[MASKED]';
        } else {
          maskedRecord[key] = this.maskSensitiveData(maskedRecord[key]);
        }
      }
      
      return maskedRecord;
    }
    
    return data;
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    // Mask sensitive data in production
    const maskedArgs = this.config.isDevelopment ? args : args.map(arg => this.maskSensitiveData(arg));
    
    switch (level) {
      case 'debug':
        console.log(prefix, message, ...maskedArgs);
        break;
      case 'info':
        console.info(prefix, message, ...maskedArgs);
        break;
      case 'warn':
        console.warn(prefix, message, ...maskedArgs);
        break;
      case 'error':
        console.error(prefix, message, ...maskedArgs);
        break;
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.formatMessage('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.formatMessage('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.formatMessage('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.formatMessage('error', message, ...args);
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }
}

export const logger = new Logger();