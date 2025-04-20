// Copied from src/info/error-handler.ts
// Original file path: src/info/error-handler.ts
/**
 * 錯誤處理和重試機制
 * 處理影片資訊獲取過程中的錯誤，實現智能重試
 */

import { infoLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
// No need to import withRetry here

// 可重試的錯誤類型
const RETRYABLE_ERROR_TYPES = [
  'TimeoutError',
  'NetworkError',
  'ConnectionError',
  'NavigationError',
  'AbortError'
];

// 重試配置接口
export interface RetryConfig {
  maxRetries: number;    // 最大重試次數
  baseDelay: number;     // 基礎延遲時間（毫秒）
  maxDelay: number;      // 最大延遲時間（毫秒）
  factor: number;        // 退避因子（延遲時間增長率）
}

// 默認重試配置
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 15000,
  factor: 2
};

/**
 * 判斷錯誤是否可重試
 * @param error 錯誤對象
 * @returns boolean 是否可重試
 */
export function isRetryableError(error: Error): boolean {
  // 檢查錯誤類型
  if (RETRYABLE_ERROR_TYPES.some(type => error.name.includes(type))) {
    return true;
  }

  // 檢查錯誤消息中的關鍵詞
  const errorMessage = error.message.toLowerCase();
  const retryableMessages = [
    'timeout',
    'network',
    'connection',
    'temporarily unavailable',
    'rate limit',
    'too many requests',
    'server error',
    'internal error',
    'socket hang up',
    'econnreset',
    'econnrefused',
    'etimedout'
  ];

  if (retryableMessages.some(msg => errorMessage.includes(msg))) {
    return true;
  }

  // 檢查 HTTP 狀態碼（如果存在）
  if ('statusCode' in error && typeof (error as any).statusCode === 'number') {
    const statusCode = (error as any).statusCode;
    // 5xx 錯誤和一些 4xx 錯誤可以重試
    return statusCode >= 500 || statusCode === 429 || statusCode === 408;
  }

  // 默認不重試
  return false;
}

/**
 * 計算重試延遲時間
 * @param attempt 當前嘗試次數（從 1 開始）
 * @param config 重試配置
 * @returns number 延遲時間（毫秒）
 */
export function calculateRetryDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  // 指數退避策略: baseDelay * (factor ^ (attempt - 1))
  let delay = config.baseDelay * Math.pow(config.factor, attempt - 1);

  // 添加隨機抖動，避免多個請求同時重試
  delay = delay * (0.8 + Math.random() * 0.4);

  // 限制在最大延遲時間內
  return Math.min(delay, config.maxDelay);
}

/**
 * 帶退避策略的重試函數
 * @param fetcher 執行的函數
 * @param config 重試配置
 * @returns Promise<T> 函數執行結果
 */
export async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retryConfig.maxRetries) {
    try {
      // 嘗試執行操作
      return await fetcher();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      attempt++;

      // 如果已達到最大重試次數或錯誤不可重試，則拋出錯誤
      if (attempt > retryConfig.maxRetries || !isRetryableError(err)) {
        if (attempt > retryConfig.maxRetries) {
        logger.debug(`達到最大重試次數: ${err.message}`);
      } else {
        logger.debug(`錯誤不可重試: ${err.message}`);
      }
        throw err;
      }

      // 計算延遲時間
      const delay = calculateRetryDelay(attempt, retryConfig);

      logger.debug(`操作失敗，${delay}ms 後重試 (嘗試 ${attempt}/${retryConfig.maxRetries}): ${err.message}`);

      // 等待後重試
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // 理論上不應該執行到這裡，但為了類型安全
  throw lastError || new Error('重試失敗');
}

/**
 * 處理特定的抖音 API 錯誤
 * @param error 錯誤對象
 * @returns Error 包含有用診斷信息的錯誤
 */
export function handleDouyinApiError(error: any): Error {
  // 原始錯誤
  const originalError = error instanceof Error ? error : new Error(String(error));

  // 嘗試解析抖音特定錯誤
  try {
    // 檢查是否包含 JSON 響應
    if (error.response && typeof error.response.json === 'function') {
      const responseData = error.response.json();

      if (responseData && responseData.statusCode) {
        // 處理特定的抖音 API 錯誤碼
        switch (responseData.statusCode) {
          case 8:
            return new Error('抖音 API 請求頻率超過限制，請稍後再試');
          case 2101:
            return new Error('抖音 Cookie 已失效，請重新登入');
          case 2154:
            return new Error('該影片需要登入後才能查看');
          case 2190:
            return new Error('該影片不存在或已被刪除');
          default:
            return new Error(`抖音 API 錯誤: ${responseData.statusCode} - ${responseData.statusMsg || '未知錯誤'}`);
        }
      }
    }
  } catch (parseError) {
    // 解析錯誤，返回原始錯誤
    logger.debug('解析抖音 API 錯誤失敗:', parseError);
  }

  // 預處理常見的抖音錯誤信息
  const errorMessage = originalError.message.toLowerCase();

  if (errorMessage.includes('cookie') && (errorMessage.includes('invalid') || errorMessage.includes('expired'))) {
    return new Error('抖音 Cookie 已失效，請重新登入');
  }

  if (errorMessage.includes('captcha') || errorMessage.includes('人機驗證')) {
    return new Error('遇到抖音人機驗證，請稍後再試或更新 Cookie');
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    return new Error('請求頻率過高，已被抖音限制，請稍後再試');
  }

  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return new Error('影片不存在或已被刪除');
  }

  // 返回原始錯誤
  return originalError;
}