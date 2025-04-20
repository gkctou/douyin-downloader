/**
 * 通用網絡請求工具
 * 提供封裝的 fetch API，包含重試和超時處理
 */

import { utilsLogger as logger } from './logger'; // Use the utils logger

/**
 * 請求選項接口
 */
export interface FetchOptions extends RequestInit {
  timeout?: number; // 超時時間（毫秒）
  retries?: number; // 重試次數
  retryDelay?: number; // 重試延遲（毫秒）
}

/**
 * 默認請求選項
 */
const DEFAULT_FETCH_OPTIONS: FetchOptions = {
  timeout: 10000, // 默認超時時間為 10 秒
  retries: 3, // 默認重試 3 次
  retryDelay: 1000, // 默認重試間隔 1 秒
  headers: {
    // Keep a generic User-Agent, platform-specific headers can be added in options
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
  }
};

/**
 * 延遲函數
 * @param ms 延遲毫秒數
 * @returns Promise<void>
 */
export const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * 增強的 fetch 函數
 * 支持超時、重試和錯誤處理
 * @param url 請求 URL
 * @param options 請求選項
 * @returns Promise<Response>
 */
export async function enhancedFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  // Merge default options with provided options, ensuring headers are merged correctly
  const mergedOptions = {
      ...DEFAULT_FETCH_OPTIONS,
      ...options,
      headers: {
          ...(DEFAULT_FETCH_OPTIONS.headers || {}),
          ...(options.headers || {}),
      },
  };
  const { timeout, retries, retryDelay, ...fetchOptions } = mergedOptions;
  let attempt = 0;

  while (attempt <= retries!) {
    attempt++;
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const controller = new AbortController();
      if (timeout) {
          timeoutId = setTimeout(() => controller.abort(), timeout);
      }

      fetchOptions.signal = controller.signal;

      logger.debug(`發起請求: ${fetchOptions.method || 'GET'} ${url} (嘗試 ${attempt})`);
      const response = await fetch(url, fetchOptions);

      if (timeoutId) {
          clearTimeout(timeoutId);
      }

      if (!response.ok) {
        // 處理非 2xx 狀態碼
        let errorText = '';
        try {
            errorText = await response.text();
        } catch (textError) {
            logger.warn(`無法讀取錯誤響應體: ${textError}`);
        }
        const errorMessage = `HTTP 錯誤 ${response.status} (${response.statusText}) for ${url}: ${errorText.slice(0, 200)}`; // Limit error text length
        logger.warn(`請求失敗: ${errorMessage}`);
        // Throw an error that includes the status code for better handling
        const httpError = new Error(errorMessage);
        (httpError as any).statusCode = response.status;
        throw httpError;
      }

      logger.debug(`請求成功: ${url}`);
      return response;
    } catch (error) {
      if (timeoutId) {
          clearTimeout(timeoutId);
      }
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(`請求失敗 (嘗試 ${attempt}/${retries! + 1}): ${err.message}`);

      // Check if the error is an abort error due to timeout
      if (err.name === 'AbortError') {
          logger.error(`請求 ${url} 超時 (超時時間: ${timeout}ms)`);
          // Optionally rethrow a specific timeout error
          // throw new Error(`Request timed out after ${timeout}ms: ${url}`);
      }

      if (attempt > retries!) {
        logger.error(`請求 ${url} 最終失敗: ${err.message}`);
        throw err; // 達到最大重試次數後拋出錯誤
      }

      // 等待一段時間後重試
      const delayTime = retryDelay! * Math.pow(2, attempt - 1); // Exponential backoff
      logger.debug(`等待 ${delayTime}ms 後重試...`);
      await delay(delayTime);
    }
  }
  // 如果循環結束仍未成功（理論上不應發生，除非 retries < 0）
  throw new Error('請求失敗，達到最大重試次數');
}

/**
 * GET 請求，返回 JSON
 * @param url 請求 URL
 * @param options 請求選項
 * @returns Promise<T> 返回 JSON 響應
 */
export async function getJson<T = any>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await enhancedFetch(url, { ...options, method: 'GET' });
  try {
      return await response.json() as T;
  } catch (e) {
      logger.error(`解析 JSON 失敗 from ${url}:`, e);
      throw new Error(`Failed to parse JSON response from ${url}`);
  }
}

/**
 * POST 請求，發送 JSON，返回 JSON
 * @param url 請求 URL
 * @param data 請求數據
 * @param options 請求選項
 * @returns Promise<T> 返回 JSON 響應
 */
export async function postJson<T = any>(url: string, data: any, options: FetchOptions = {}): Promise<T> {
  const response = await enhancedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // User-defined headers should override defaults if specified in options
      ...(options.headers || {}),
    },
    body: JSON.stringify(data),
    ...options, // Spread other options like timeout, retries
  });
   try {
      return await response.json() as T;
  } catch (e) {
      logger.error(`解析 JSON 失敗 from ${url}:`, e);
      throw new Error(`Failed to parse JSON response from ${url}`);
  }
}