/**
 * 通用重試與並發控制工具
 * 使用 @supercharge/promise-pool 實現並發控制和重試機制
 */

import { PromisePool } from '@supercharge/promise-pool';
import { utilsLogger as logger } from './logger'; // Use the utils logger
import { delay } from './fetch'; // Import delay from shared fetch utils

/**
 * 重試選項接口
 */
export interface RetryOptions {
  retries?: number; // 最大重試次數
  minDelay?: number; // 最小延遲時間（毫秒）
  maxDelay?: number; // 最大延遲時間（毫秒）
  factor?: number; // 退避因子（延遲時間增長率）
  /**
   * 重試前的回調函數
   * @param error 導致重試的錯誤
   * @param attempt 即將進行的嘗試次數 (從 1 開始)
   */
  onRetry?: (error: Error, attempt: number) => void;
  /**
   * 判斷錯誤是否應該觸發重試的函數
   * @param error 錯誤對象
   * @returns boolean 是否應該重試
   */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * 默認重試選項
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  retries: 3,
  minDelay: 1000,
  maxDelay: 30000,
  factor: 2,
  onRetry: (error, attempt) => logger.debug(`重試 #${attempt}，原因: ${error.message}`),
  shouldRetry: (error: Error) => true // 默認重試所有錯誤
};

/**
 * 計算重試延遲時間 (帶指數退避和抖動)
 * @param attempt 當前嘗試次數（從 1 開始）
 * @param options 重試選項
 * @returns 延遲時間（毫秒）
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const { minDelay, maxDelay, factor } = options;

  // 指數退避: minDelay * (factor ^ (attempt - 1))
  let delay = minDelay * Math.pow(factor, attempt - 1);

  // 添加一些隨機性 (抖動) 以避免 "雷暴" 效應
  delay = delay * (0.8 + Math.random() * 0.4);

  // 限制在最大延遲時間內
  return Math.min(delay, maxDelay);
}

/**
 * 帶重試機制的函數執行器
 * @param fn 要執行的異步函數
 * @param options 重試選項
 * @returns Promise<T> 函數執行結果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const mergedOptions: Required<RetryOptions> = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const { retries, onRetry, shouldRetry } = mergedOptions;

  let attempt = 0;
  let lastError: Error = new Error("Unknown error during retry");

  while (attempt <= retries) {
    try {
      // 執行函數
      return await fn();
    } catch (error) {
      // 轉換為 Error 對象
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++; // Increment attempt count here

      // 檢查是否應該重試
      if (!shouldRetry(lastError)) {
          logger.warn(`錯誤不可重試: ${lastError.message}`);
          throw lastError;
      }

      // 如果已達到最大重試次數，拋出錯誤
      if (attempt > retries) {
        logger.error(`函數執行失敗，已達到最大重試次數 (${retries}): ${lastError.message}`);
        throw lastError;
      }

      // 調用重試回調 (傳遞的是下一次嘗試的序號)
      onRetry(lastError, attempt);

      // 計算延遲時間
      const delayTime = calculateDelay(attempt, mergedOptions);
      logger.debug(`等待 ${delayTime.toFixed(0)}ms 後重試...`);

      // 等待後重試
      await delay(delayTime);
      // attempt is already incremented for the next loop iteration
    }
  }
  // 理論上不應該執行到這裡
  throw lastError;
}

/**
 * 並發處理選項接口
 */
export interface ProcessBatchOptions extends RetryOptions {
    concurrency?: number; // 並行數
    /**
     * 批處理進度回調
     * @param completed 已完成的任務數
     * @param total 總任務數
     * @param errors 錯誤列表 (如果有的話)
     */
    onProgress?: (completed: number, total: number, errors: Error[]) => void;
}


/**
 * 並發執行任務列表，帶重試機制
 * @param items 要處理的項目數組
 * @param fn 處理每個項目的異步函數
 * @param options 執行選項，包括並行數和重試選項
 * @returns Promise<{ results: R[], errors: Error[] }> 包含成功結果和錯誤的對象
 */
export async function processBatch<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: ProcessBatchOptions = {}
): Promise<{ results: R[], errors: Error[] }> {
  const {
      concurrency = 3,
      retries = 3,
      minDelay = 1000,
      maxDelay = 30000,
      factor = 2,
      onRetry = DEFAULT_RETRY_OPTIONS.onRetry,
      shouldRetry = DEFAULT_RETRY_OPTIONS.shouldRetry,
      onProgress
  } = options;

  let completed = 0;
  const total = items.length;
  const allErrors: Error[] = [];

  logger.info(`開始並行處理 ${total} 個任務，並行數: ${concurrency}, 重試次數: ${retries}`);

  const { results, errors } = await PromisePool
    .withConcurrency(concurrency)
    .for(items)
    .handleError(async (error, item, pool) => {
        // PromisePool 的錯誤處理器
        const err = error instanceof Error ? error : new Error(String(error));
        allErrors.push(err); // 收集錯誤
        logger.error(`處理項目失敗 (PromisePool): ${err.message}`, err);
        // 可以選擇停止池: pool.stop()
    })
    .process(async (item, index) => {
      const result = await withRetry(
          () => fn(item, index),
          { retries, minDelay, maxDelay, factor, onRetry, shouldRetry }
      );
      completed++;
      if (onProgress) {
        // 提供實時進度，包括當前錯誤列表
        onProgress(completed, total, allErrors);
      }
      return result;
    });

  // PromisePool 的 errors 數組可能包含由 handleError 捕獲的錯誤
  // 我們已經在 allErrors 中收集了 withRetry 拋出的最終錯誤
  const finalErrors = allErrors.concat(errors); // 合併兩者以防萬一

  if (finalErrors.length > 0) {
    logger.warn(`處理完成，${finalErrors.length}/${total} 個任務最終失敗`);
    // Optionally log details of each error
    // finalErrors.forEach((err, i) => logger.debug(`失敗 #${i + 1}: ${err.message}`));
  } else {
    logger.info(`成功處理所有 ${total} 個任務`);
  }

  // results 數組只包含成功完成的任務的結果
  return { results: results as R[], errors: finalErrors };
}