/**
 * 通用性能監測工具
 * 提供高級性能監測和分析功能
 */

import { utilsLogger as logger } from './logger'; // Use the utils logger
import { performance } from 'perf_hooks'; // Use Node.js's performance API

/**
 * 性能監測器接口
 */
export interface PerformanceMonitor {
  mark(name: string): void;
  measure(name: string, startMark: string, endMark: string): number;
  getMeasurements(): Record<string, number>;
  finalize(): Record<string, number>;
}

/**
 * 性能監測選項
 */
export interface PerformanceMonitorOptions {
  name: string; // 性能監測名稱
  autoLog?: boolean; // 是否自動記錄日誌
  logResults?: boolean; // 是否在結束時記錄結果
  keepHistory?: boolean; // 是否保留所有測量歷史
  maxHistoryLength?: number; // 歷史記錄最大長度
}

/**
 * 性能監測器實現
 * 用於測量和分析代碼執行性能
 */
export class PerformanceMonitor {
  private startTime: number;
  private active: boolean = true;
  private markers: Map<string, number> = new Map();
  private measurements: Map<string, number> = new Map();
  private history: Array<{ name: string, duration: number, timestamp: number }> = [];
  private readonly options: Required<PerformanceMonitorOptions>;

  /**
   * 創建性能監測器
   * @param options 性能監測選項
   */
  constructor(options: PerformanceMonitorOptions) {
    this.options = {
      name: options.name,
      autoLog: options.autoLog ?? false,
      logResults: options.logResults ?? true,
      keepHistory: options.keepHistory ?? false,
      maxHistoryLength: options.maxHistoryLength ?? 100
    };

    this.startTime = performance.now();
    this.markers.set('start', this.startTime);

    if (this.options.autoLog) {
      logger.debug(`[性能監測] ${this.options.name}: 開始監測`);
    }
  }

  /**
   * 設置標記點
   * @param name 標記名稱
   */
  mark(name: string): void {
    if (!this.active) {
      logger.warn(`[性能監測] ${this.options.name}: 嘗試在已結束的監測器上設置標記 ${name}`);
      return;
    }

    const time = performance.now();
    this.markers.set(name, time);

    if (this.options.autoLog) {
      const elapsed = time - this.startTime;
      logger.debug(`[性能監測] ${this.options.name}: 標記 ${name} 設置於 +${elapsed.toFixed(2)}ms`);
    }
  }

  /**
   * 測量兩個標記點之間的耗時
   * @param name 測量名稱
   * @param startMark 開始標記名稱
   * @param endMark 結束標記名稱
   * @returns 測量結果（毫秒）
   */
  measure(name: string, startMark: string, endMark: string): number {
    if (!this.markers.has(startMark) || !this.markers.has(endMark)) {
      logger.warn(`[性能監測] ${this.options.name}: 無法測量 ${startMark} 到 ${endMark}，缺少標記點`);
      return -1;
    }

    const startTime = this.markers.get(startMark)!;
    const endTime = this.markers.get(endMark)!;
    const duration = endTime - startTime;

    this.measurements.set(name, duration);

    if (this.options.keepHistory) {
      this.history.push({
        name,
        duration,
        timestamp: Date.now()
      });

      // 保持歷史記錄在限制範圍內
      if (this.history.length > this.options.maxHistoryLength) {
        this.history.shift();
      }
    }

    if (this.options.autoLog) {
      logger.debug(`[性能監測] ${this.options.name}: ${name} 耗時 ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * 獲取所有測量結果
   * @returns 測量結果記錄
   */
  getMeasurements(): Record<string, number> {
    return Object.fromEntries(this.measurements);
  }

  /**
   * 獲取性能歷史記錄
   * @returns 性能歷史記錄
   */
  getHistory(): Array<{ name: string, duration: number, timestamp: number }> {
    return [...this.history];
  }

  /**
   * 結束監測並返回結果
   * @returns 完整測量結果
   */
  finalize(): Record<string, number> {
    if (!this.active) {
      logger.warn(`[性能監測] ${this.options.name}: 嘗試結束已經結束的監測器`);
      return this.getMeasurements();
    }

    // 設置結束標記
    this.mark('end');

    // 計算總耗時
    const totalDuration = this.markers.get('end')! - this.startTime;
    const results: Record<string, number> = {
      total: totalDuration,
      ...this.getMeasurements()
    };

    // 計算各階段耗時
    let lastTime = this.startTime;
    Array.from(this.markers.entries())
      .filter(([name]) => name !== 'start' && name !== 'end')
      .sort((a, b) => a[1] - b[1])
      .forEach(([marker, time]) => {
        results[`time_to_${marker}`] = time - this.startTime;
        // Calculate time since last marker, handle potential NaN if lastTime is somehow invalid
        results[`time_in_${marker}`] = Number.isFinite(lastTime) ? time - lastTime : 0;
        lastTime = time;
      });

    // 標記監測器已結束
    this.active = false;

    // 記錄結果
    if (this.options.logResults) {
      logger.info(
        `[性能監測] ${this.options.name}: 完成，總耗時 ${totalDuration.toFixed(2)}ms`,
        { performance: results }
      );
    }

    return results;
  }

  /**
   * 監測異步函數執行性能
   * @param name 操作名稱
   * @param fn 要監測的異步函數
   * @returns Promise 解析為函數返回值和性能數據
   */
  static async monitor<T>(
    name: string,
    fn: () => Promise<T>,
    options?: Partial<PerformanceMonitorOptions>
  ): Promise<{ result: T, performance: Record<string, number> }> {
    const monitor = new PerformanceMonitor({
      name,
      ...options
    });

    try {
      monitor.mark('functionStart');
      const result = await fn();
      monitor.mark('functionEnd');
      monitor.measure('functionExecution', 'functionStart', 'functionEnd');

      return {
        result,
        performance: monitor.finalize()
      };
    } catch (error) {
      monitor.mark('functionError');
      monitor.measure('timeToError', 'functionStart', 'functionError');
      const performance = monitor.finalize();

      // 重新拋出錯誤，附加性能數據
      if (error instanceof Error) {
        (error as any).performance = performance;
      }
      throw error;
    }
  }

  /**
   * 創建性能監測裝飾器
   * 用於裝飾類方法並監測其性能
   * @param options 性能監測選項
   * @returns 方法裝飾器
   */
  static monitorMethod(options: Partial<PerformanceMonitorOptions> = {}) {
    return function(
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = function(...args: any[]) {
        const methodName = options.name || `${target.constructor.name}.${propertyKey}`;
        const monitor = new PerformanceMonitor({
          name: methodName,
          ...options
        });

        try {
          const result = originalMethod.apply(this, args);

          // 處理異步方法 (Promise)
          if (result instanceof Promise) {
            return result
              .then(value => {
                monitor.mark('resolved');
                monitor.finalize();
                return value;
              })
              .catch(error => {
                monitor.mark('rejected');
                monitor.finalize();
                throw error;
              });
          }

          // 處理同步方法
          monitor.finalize();
          return result;
        } catch (error) {
          monitor.mark('error');
          monitor.finalize();
          throw error;
        }
      };

      return descriptor;
    };
  }
}

/**
 * 全局性能監測器工廠
 */
export class PerformanceMonitorFactory {
  private static monitors: Map<string, PerformanceMonitor> = new Map();

  /**
   * 創建或獲取性能監測器
   * @param name 監測器名稱
   * @param options 性能監測選項
   * @returns 性能監測器實例
   */
  static getMonitor(
    name: string,
    options: Partial<Omit<PerformanceMonitorOptions, 'name'>> = {}
  ): PerformanceMonitor {
    if (!this.monitors.has(name)) {
      this.monitors.set(
        name,
        new PerformanceMonitor({
          name,
          ...options
        })
      );
    }

    return this.monitors.get(name)!;
  }

  /**
   * 結束所有活躍的監測器
   * @returns 所有監測器的結果
   */
  static finalizeAll(): Record<string, Record<string, number>> {
    const results: Record<string, Record<string, number>> = {};

    this.monitors.forEach((monitor, name) => {
      results[name] = monitor.finalize();
    });

    // 清空監測器列表
    this.monitors.clear();

    return results;
  }
}

/**
 * 監測函數執行時間的簡單工具
 * @param name 操作名稱
 * @param fn 要監測的函數
 * @returns 函數返回值
 */
export function time<T>(name: string, fn: () => T): T {
  const start = performance.now();
  try {
    const result = fn();
    const end = performance.now();
    logger.debug(`[時間] ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  } catch (error) {
    const end = performance.now();
    logger.debug(`[時間] ${name} (錯誤): ${(end - start).toFixed(2)}ms`);
    throw error;
  }
}

/**
 * 監測異步函數執行時間的簡單工具
 * @param name 操作名稱
 * @param fn 要監測的異步函數
 * @returns Promise 解析為函數返回值
 */
export async function timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const end = performance.now();
    logger.debug(`[時間] ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  } catch (error) {
    const end = performance.now();
    logger.debug(`[時間] ${name} (錯誤): ${(end - start).toFixed(2)}ms`);
    throw error;
  }
}