import { config } from '../config/env.js';

// Simple logger implementation
class Logger {
  constructor(level = 'info') {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.level = level;
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase();
    
    if (typeof message === 'object') {
      return `[${timestamp}] ${levelUpper}: ${JSON.stringify(message, null, 2)}`;
    }
    
    let formattedMessage = `[${timestamp}] ${levelUpper}: ${message}`;
    
    if (args.length > 0) {
      const formattedArgs = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      formattedMessage += ` ${formattedArgs}`;
    }
    
    return formattedMessage;
  }

  error(message, ...args) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, ...args));
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, ...args));
    }
  }

  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, ...args));
    }
  }
}

// Create and export logger instance
export const logger = new Logger(config.logLevel);

// Export logger class for testing
export { Logger };