// Copied from src/info/index.ts
// Original file path: src/info/index.ts
/**
 * 影片資訊獲取模組
 * 提供從抖音影片連結獲取詳細資訊的功能
 */

import { infoLogger as logger, LogLevel } from '../../utils/logger'; // Updated path to shared utils logger
import { VideoInfo, FetchVideoOptions } from '../../types'; // Use common VideoInfo
import { processBatch as batchProcessor } from './batch-processor';
import { processTextContent as textProcessor } from './text-processor';
import { Page } from 'puppeteer';

// 重新導出影片資訊獲取功能
export { fetchVideoDetail } from './fetch-video-detail';
// Removed export from './extractors' as the file is deleted
export { processBatch } from './batch-processor';
export { processTextContent } from './text-processor';
// export { browserManager, cleanupBrowser } from '../../utils/browser'; // Removed: Use new browser manager
export { isRetryableError, handleDouyinApiError } from './error-handler'; // Keep local error handler for now
// fetchWithRetry is now just withRetry from utils/retry
export { fetchUserVideos, extractSecUserId } from './user';

/**
 * 從文本中解析抖音影片連結，並獲取這些影片的詳細資訊
 * @param text 包含一個或多個抖音連結的文本
 * @param cookie 有效的抖音 Cookie 字串
 * @param options 獲取選項
 * @returns Promise<VideoInfoResult[]> 影片資訊陣列
 */
export async function fetchVideosInfoText(
  text: string,
  page: Page, // Changed: Accept Page object
  // cookie: string, // Removed
  options: FetchVideoOptions = {}
): Promise<VideoInfo[]> { // Use common VideoInfo
  if (!text || text.trim() === '') {
    logger.warn('提供的文本為空');
    return [];
  }

  // Removed: Cookie check, assuming page is valid and has cookies if needed

  logger.info('[fetchVideosInfoText] 從文本中提取並獲取影片資訊');

  try {
    // 使用文本處理器處理文本內容
    return await textProcessor(text, page, options); // Pass page instead of cookie
  } catch (error) {
    logger.error('[fetchVideosInfoText] 從文本獲取影片資訊失敗:', error as Error);
    throw error;
  }
}

/**
 * 獲取指定抖音影片 URL 的詳細資訊
 * @param videoUrls 抖音影片 URL 陣列
 * @param cookie 有效的抖音 Cookie 字串
 * @param options 獲取選項
 * @returns Promise<VideoInfoResult[]> 影片資訊陣列
 */
export async function fetchVideosInfoUrls(
  videoUrls: string[],
  page: Page, // Changed: Accept Page object
  // cookie: string, // Removed
  options: FetchVideoOptions = {}
): Promise<VideoInfo[]> { // Use common VideoInfo
  if (!videoUrls || videoUrls.length === 0) {
    logger.warn('未提供影片 URL');
    return [];
  }

  // Removed: Cookie check, assuming page is valid and has cookies if needed

  logger.info(`[fetchVideosInfoUrls] 準備獲取 ${videoUrls.length} 個影片的資訊`);

  try {
    // 使用批量處理功能獲取影片資訊
    return await batchProcessor(videoUrls, page, options); // Pass page instead of cookie
  } catch (error) {
    logger.error('[fetchVideosInfoUrls] 獲取影片資訊失敗:', error as Error);
    throw error;
  } finally {
    // 可以選擇在這裡清理瀏覽器資源，但通常我們會保持瀏覽器實例以備後續使用
    // 進程結束時會自動清理
  }
}