// Copied from src/download/error-handler.ts
// Original file path: src/download/error-handler.ts
/**
 * 錯誤處理和重試機制
 * 提供下載錯誤處理和智能重試邏輯
 */

import { downloadLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
// No need to import withRetry here, it seems to be used elsewhere (e.g., video-downloader)

/**
 * 下載錯誤類型
 */
export class DownloadError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly url: string;

  constructor(
    message: string,
    url: string,
    code: string = 'DOWNLOAD_ERROR',
    retryable: boolean = true
  ) {
    super(message);
    this.name = 'DownloadError';
    this.code = code;
    this.retryable = retryable;
    this.url = url;
  }

  /**
   * 判斷錯誤是否可重試
   */
  public isRetryable(): boolean {
    return this.retryable;
  }
}

/**
 * 重試選項
 */
export interface RetryOptions {
  retries: number;             // 最大重試次數
  minDelay?: number;           // 最小延遲時間（毫秒）
  maxDelay?: number;           // 最大延遲時間（毫秒）
  factor?: number;             // 退避因子（延遲時間增長率）
  onRetry?: (error: Error, attempt: number) => void; // 重試回調
  onProgress?: (progress: number) => void; // 進度回調
}

/**
 * 計算重試延遲時間
 * 使用指數退避策略
 * @param attempt 當前嘗試次數（從 1 開始）
 * @param options 重試選項
 * @returns 延遲時間（毫秒）
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  const { minDelay = 1000, maxDelay = 30000, factor = 2 } = options;

  // 指數退避: minDelay * (factor ^ (attempt - 1))
  let delay = minDelay * Math.pow(factor, attempt - 1);

  // 添加一些隨機性以避免 "雷暴" 效應
  delay = delay * (0.8 + Math.random() * 0.4);

  // 限制在最大延遲時間內
  return Math.min(delay, maxDelay);
}

/**
 * 帶重試機制的下載函數
 * @param downloadFn 下載函數
 * @param url 下載 URL
 * @param options 重試選項
 * @returns Promise<T> 下載結果
 */
export async function downloadWithRetry<T>(
  downloadFn: (onProgress?: (progress: number) => void) => Promise<T>,
  url: string,
  options: RetryOptions
): Promise<T> {
  const { retries, onRetry, onProgress } = options;

  let attempt = 0;
  let lastError: Error;

  while (attempt <= retries) {
    attempt++;

    try {
      // 執行下載函數
      return await downloadFn(onProgress);
    } catch (error) {
      // 轉換為 Error 對象
      lastError = error instanceof Error ? error : new Error(String(error));

      // 檢查錯誤是否可重試
      const isRetryable =
        error instanceof DownloadError
          ? error.isRetryable()
          : isRetryableError(lastError);

      // 如果已達到最大重試次數或錯誤不可重試，拋出錯誤
      if (attempt > retries || !isRetryable) {
        logger.error(`下載 ${url} 失敗，不再重試`, lastError);
        throw lastError;
      }

      // 調用重試回調
      if (onRetry) {
        onRetry(lastError, attempt);
      }

      // 記錄日誌
      logger.warn(`下載 ${url} 失敗，準備重試 #${attempt}/${retries}:`,
        lastError.message);

      // 計算延遲時間
      const delay = calculateDelay(attempt, options);

      // 等待後重試
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // 理論上不應該執行到這裡
  throw lastError!;
}

/**
 * 判斷錯誤是否可重試
 * @param error 錯誤對象
 * @returns 是否可重試
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // 網絡錯誤通常可重試
  if (
    name.includes('network') ||
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('429') || // Too Many Requests
    message.includes('503') || // Service Unavailable
    message.includes('504')    // Gateway Timeout
  ) {
    return true;
  }

  // 資源錯誤通常不可重試
  if (
    message.includes('404') || // Not Found
    message.includes('403') || // Forbidden
    message.includes('401') || // Unauthorized
    message.includes('400') || // Bad Request
    message.includes('not found') ||
    message.includes('forbidden') ||
    message.includes('unauthorized') ||
    message.includes('bad request') ||
    message.includes('permission denied')
  ) {
    return false;
  }

  // 默認可重試
  return true;
}

/**
 * 處理下載錯誤並返回友好的錯誤消息
 * @param error 原始錯誤
 * @param url 下載 URL
 * @returns 友好的錯誤消息
 */
export function getDownloadErrorMessage(error: unknown, url: string): string {
  if (error instanceof DownloadError) {
    return error.message;
  }

  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message.toLowerCase();

  // 常見錯誤類型的友好消息
  if (message.includes('timeout') || message.includes('timed out')) {
    return `下載超時，請檢查網絡連接或稍後再試`;
  }

  if (message.includes('404') || message.includes('not found')) {
    return `影片資源不存在或已被移除`;
  }

  if (message.includes('403') || message.includes('forbidden')) {
    return `無權訪問此影片資源，可能需要登入或權限`;
  }

  if (message.includes('429') || message.includes('too many requests')) {
    return `下載請求過於頻繁，請稍後再試`;
  }

  // 其他錯誤使用原始消息
  return `下載影片時發生錯誤: ${err.message}`;
}