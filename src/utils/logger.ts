/**
 * 通用日誌工具
 * 提供統一的日誌輸出功能，支持不同的日誌級別、格式化和範圍
 */

import { performance } from 'perf_hooks'; // 使用 Node.js 的 performance API

/**
 * 日誌級別枚舉
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4 // 用於完全禁用日誌
}

/**
 * 日誌級別名稱映射
 */
export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.NONE]: 'NONE'
};

/**
 * 日誌選項接口
 */
export interface LoggerOptions {
  scope?: string; // 日誌範圍標識
  level?: LogLevel; // 日誌級別
  formatter?: LogFormatter; // 自訂格式化器
  transports?: LogTransport[]; // 日誌輸出目標
  metadata?: Record<string, any>; // 附加到每條日誌的元數據
}

/**
 * 日誌記錄接口
 */
export interface LogEntry {
  timestamp: Date; // 日誌時間戳
  level: LogLevel; // 日誌級別
  levelName: string; // 日誌級別名稱
  scope: string; // 日誌範圍
  message: string; // 日誌消息
  data: any[]; // 附加數據
  metadata?: Record<string, any>; // 元數據
}

/**
 * 日誌格式化器類型
 */
export type LogFormatter = (entry: LogEntry) => string;

/**
 * 日誌輸出目標接口
 */
export interface LogTransport {
  log(entry: LogEntry): void;
}

/**
 * 控制台日誌輸出目標
 */
export class ConsoleTransport implements LogTransport {
  /**
   * 輸出日誌到控制台
   * @param entry 日誌記錄
   */
  log(entry: LogEntry): void {
    const method = this.getConsoleMethod(entry.level);
    // 確保傳遞給控制台方法的是字符串，避免類型錯誤
    method(entry.message);
  }

  /**
   * 根據日誌級別獲取相應的控制台方法
   * @param level 日誌級別
   * @returns 控制台方法
   */
  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
      default:
        return console.log;
    }
  }
}

/**
 * 默認日誌格式化器
 * @param entry 日誌記錄
 * @returns 格式化後的日誌字符串
 */
export const defaultFormatter: LogFormatter = (entry: LogEntry): string => {
  const timestamp = entry.timestamp.toISOString();
  const scope = entry.scope ? `[${entry.scope}]` : '';
  const level = `[${LOG_LEVEL_NAMES[entry.level]}]`;

  let message = `${timestamp} ${level} ${scope}: ${entry.message}`;

  // 格式化附加數據
  if (entry.data && entry.data.length > 0) {
    try {
      const dataStr = entry.data.map(item => {
        if (item instanceof Error) {
          return item.stack || item.message;
        }
        if (typeof item === 'object' && item !== null) {
          // Handle circular references safely
          try {
            return JSON.stringify(item, null, 2);
          } catch (jsonError) {
            return `[無法序列化對象: ${jsonError}]`;
          }
        }
        return String(item);
      }).join(' ');

      if (dataStr.trim()) {
        message += ` ${dataStr}`;
      }
    } catch (e) {
      message += ` [無法格式化附加數據: ${e}]`;
    }
  }

  // 添加元數據
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    try {
      message += ` (metadata: ${JSON.stringify(entry.metadata)})`;
    } catch (e) {
      message += ` [無法格式化元數據: ${e}]`;
    }
  }

  return message;
};

/**
 * Logger 類
 * 日誌工具類，用於統一管理和格式化日誌輸出
 */
export class Logger {
  private scope: string;
  private level: LogLevel;
  private formatter: LogFormatter;
  private transports: LogTransport[];
  private metadata?: Record<string, any>;

  /**
   * 創建 Logger 實例
   * @param options 日誌選項
   */
  constructor(options: LoggerOptions = {}) {
    this.scope = options.scope || '';
    // Determine default level first
    let defaultLevel = options.level ?? (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG);

    // --- Check args for silent mode override ---
    // This check runs when the logger instance (including rootLogger) is created
    const args = process.argv;
    const commandIndex = args.findIndex(arg => ['info', 'list'].includes(arg));
    const hasOutputFileOption = args.includes('-f') || args.includes('--file');

    if (commandIndex !== -1 && ['info', 'list'].includes(args[commandIndex]) && !hasOutputFileOption) {
      // Override default level if silent mode is detected
      defaultLevel = LogLevel.NONE;
      // We could potentially override console here too, but let's try logger level first
    }
    // ---

    this.level = defaultLevel;
    this.formatter = options.formatter || defaultFormatter;
    this.transports = options.transports || [new ConsoleTransport()];
    this.metadata = options.metadata;
  }

  /**
   * 創建日誌記錄
   * @param level 日誌級別
   * @param message 日誌消息
   * @param data 附加數據
   * @returns 日誌記錄
   */
  private createLogEntry(level: LogLevel, message: string, data: any[]): LogEntry {
    return {
      timestamp: new Date(),
      level,
      levelName: LOG_LEVEL_NAMES[level],
      scope: this.scope,
      message,
      data,
      metadata: this.metadata
    };
  }

  /**
   * 輸出日誌
   * @param level 日誌級別
   * @param message 日誌消息
   * @param data 附加數據
   */
  private log(level: LogLevel, message: string, ...data: any[]): void {
    // 檢查日誌級別
    if (level < this.level) {
      return;
    }

    // 創建日誌記錄
    const entry = this.createLogEntry(level, message, data);

    // 格式化日誌
    const formattedMessage = this.formatter(entry);

    // 更新日誌記錄中的消息
    entry.message = formattedMessage;

    // 輸出到所有目標
    for (const transport of this.transports) {
      try {
        transport.log(entry);
      } catch (error) {
        // 避免日誌輸出錯誤破壞程序流程
        console.error('日誌輸出失敗:', error);
      }
    }
  }

  /**
   * 輸出調試日誌
   * @param message 日誌消息
   * @param data 附加數據
   */
  debug(message: string, ...data: any[]): void {
    this.log(LogLevel.DEBUG, message, ...data);
  }

  /**
   * 輸出信息日誌
   * @param message 日誌消息
   * @param data 附加數據
   */
  info(message: string, ...data: any[]): void {
    this.log(LogLevel.INFO, message, ...data);
  }

  /**
   * 輸出警告日誌
   * @param message 日誌消息
   * @param data 附加數據
   */
  warn(message: string, ...data: any[]): void {
    this.log(LogLevel.WARN, message, ...data);
  }

  /**
   * 輸出錯誤日誌
   * @param message 錯誤消息
   * @param error 錯誤對象
   * @param data 附加數據
   */
  error(message: string, error?: Error | unknown, ...data: any[]): void {
    const errorObj = error instanceof Error ? error : undefined;
    const additionalData = error instanceof Error ? data : [error, ...data];
    if (errorObj) {
      this.log(LogLevel.ERROR, message, errorObj, ...additionalData);
    } else {
      this.log(LogLevel.ERROR, message, ...additionalData);
    }
  }

  /**
   * 設置日誌級別
   * @param level 日誌級別
   * @returns 當前 Logger 實例 (用於鏈式調用)
   */
  setLevel(level: LogLevel): Logger {
    this.level = level;
    return this;
  }

  /**
   * 添加元數據
   * @param metadata 元數據對象
   * @returns 當前 Logger 實例 (用於鏈式調用)
   */
  addMetadata(metadata: Record<string, any>): Logger {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * 創建一個子日誌記錄器，繼承父日誌記錄器的配置
   * @param subScope 子日誌範圍
   * @param metadata 附加元數據
   * @returns 子日誌記錄器實例
   */
  createSubLogger(subScope: string, metadata?: Record<string, any>): Logger {
    const newScope = this.scope ? `${this.scope}:${subScope}` : subScope;
    return new Logger({
      scope: newScope,
      level: this.level,
      formatter: this.formatter,
      transports: this.transports,
      metadata: { ...this.metadata, ...metadata }
    });
  }
}

/**
 * 創建一個日誌記錄器
 * @param scope 日誌範圍
 * @param options 日誌選項
 * @returns Logger 實例
 */
export function createLogger(scope: string, options: LoggerOptions = {}): Logger {
  return new Logger({ ...options, scope });
}

// 創建默認的根日誌記錄器
export const rootLogger = createLogger('app'); // Changed default scope name

// 導出特定模組的日誌記錄器 (可以根據需要調整或移除)
export const authLogger = rootLogger.createSubLogger('auth');
export const parserLogger = rootLogger.createSubLogger('parser');
export const infoLogger = rootLogger.createSubLogger('info');
export const downloadLogger = rootLogger.createSubLogger('download');
export const cliLogger = rootLogger.createSubLogger('cli');
export const utilsLogger = rootLogger.createSubLogger('utils'); // Added utils logger