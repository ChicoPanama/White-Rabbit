/**
 * WHITE RABBIT - Structured Logging System
 * 
 * PicoClaw-inspired pattern: JSON structured logging with component context
 * Replaces 1,094 scattered console.log statements
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  component: string;
  message: string;
  fields?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  minLevel: LogLevel;
  component: string;
  enableConsole: boolean;
  enableFile?: boolean;
  filePath?: string;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/**
 * Structured Logger - PicoClaw Pattern
 * 
 * Usage:
 *   const logger = new Logger({ component: 'scanner', minLevel: 'info' });
 *   logger.info('Scan started', { chain: 'ethereum', contract: '0x1234' });
 *   logger.error('Scan failed', { error }, err);
 */
export class Logger {
  private config: LoggerConfig;
  private static globalMinLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      minLevel: config.minLevel || Logger.globalMinLevel,
      component: config.component || 'default',
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? false,
      filePath: config.filePath,
    };
  }

  static setGlobalLevel(level: LogLevel): void {
    Logger.globalMinLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.config.minLevel];
  }

  private formatEntry(level: LogLevel, message: string, fields?: Record<string, unknown>, error?: Error): LogEntry {
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      component: this.config.component,
      message,
      fields,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private write(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    // In development, pretty print. In production, JSON.
    const isDev = process.env.NODE_ENV !== 'production';
    
    if (isDev) {
      const timestamp = entry.timestamp.split('T')[1].split('.')[0];
      const levelColor = this.getLevelColor(entry.level);
      const fields = entry.fields ? ' ' + JSON.stringify(entry.fields) : '';
      const error = entry.error ? ` \x1b[31m${entry.error.message}\x1b[0m` : '';
      
      console.log(
        `[${timestamp}] ${levelColor}[${entry.level.toUpperCase()}]\x1b[0m [${entry.component}] ${entry.message}${fields}${error}`
      );
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case 'debug': return '\x1b[36m'; // Cyan
      case 'info': return '\x1b[32m';  // Green
      case 'warn': return '\x1b[33m';  // Yellow
      case 'error': return '\x1b[31m'; // Red
      case 'fatal': return '\x1b[35m'; // Magenta
      default: return '\x1b[0m';
    }
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.write(this.formatEntry('debug', message, fields));
    }
  }

  info(message: string, fields?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.write(this.formatEntry('info', message, fields));
    }
  }

  warn(message: string, fields?: Record<string, unknown>, error?: Error): void {
    if (this.shouldLog('warn')) {
      this.write(this.formatEntry('warn', message, fields, error));
    }
  }

  error(message: string, fields?: Record<string, unknown>, error?: Error): void {
    if (this.shouldLog('error')) {
      this.write(this.formatEntry('error', message, fields, error));
    }
  }

  fatal(message: string, fields?: Record<string, unknown>, error?: Error): void {
    if (this.shouldLog('fatal')) {
      this.write(this.formatEntry('fatal', message, fields, error));
    }
    // Fatal errors should exit the process
    process.exit(1);
  }

  /**
   * Create a child logger with additional context fields
   */
  child(additionalFields: Record<string, unknown>): Logger {
    const childLogger = new Logger(this.config);
    const originalFormatEntry = this.formatEntry.bind(this);
    
    childLogger['formatEntry'] = (level: LogLevel, message: string, fields?: Record<string, unknown>, error?: Error) => {
      return originalFormatEntry(level, message, { ...additionalFields, ...fields }, error);
    };
    
    return childLogger;
  }
}

// =============================================================================
// PRE-CONFIGURED LOGGERS
// =============================================================================

export const scannerLogger = new Logger({ component: 'scanner', minLevel: 'info' });
export const analyzerLogger = new Logger({ component: 'analyzer', minLevel: 'info' });
export const databaseLogger = new Logger({ component: 'database', minLevel: 'warn' });
export const aiLogger = new Logger({ component: 'ai', minLevel: 'info' });
export const queueLogger = new Logger({ component: 'queue', minLevel: 'info' });
export const alertLogger = new Logger({ component: 'alert', minLevel: 'info' });
export const serviceLogger = new Logger({ component: 'service', minLevel: 'info' });

// Default export
export default Logger;
