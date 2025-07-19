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

  private maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      // Mask JWT tokens
      data = data.replace(/Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi, 'Bearer [MASKED]');
      // Mask tokens in URLs
      data = data.replace(/(\?|&)token=[\w-]+/gi, '$1token=[MASKED]');
      // Mask API keys
      data = data.replace(/([aA]pi[_-]?[kK]ey|apikey)[:=]\s*[\w-]+/gi, '$1=[MASKED]');
      // Mask authorization headers
      data = data.replace(/(authorization|x-api-key):\s*[\w-]+/gi, '$1: [MASKED]');
    } else if (typeof data === 'object' && data !== null) {
      const masked = Array.isArray(data) ? [...data] : { ...data };
      
      for (const key in masked) {
        if (key.toLowerCase().includes('token') || 
            key.toLowerCase().includes('auth') || 
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('secret')) {
          masked[key] = '[MASKED]';
        } else if (typeof masked[key] === 'object') {
          masked[key] = this.maskSensitiveData(masked[key]);
        } else if (typeof masked[key] === 'string') {
          masked[key] = this.maskSensitiveData(masked[key]);
        }
      }
      
      return masked;
    }
    
    return data;
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): void {
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

  debug(message: string, ...args: any[]): void {
    this.formatMessage('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.formatMessage('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.formatMessage('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
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