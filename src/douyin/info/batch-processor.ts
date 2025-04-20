// Copied from src/info/batch-processor.ts
// Original file path: src/info/batch-processor.ts
/**
 * 批量處理功能
 * 處理多個影片URL的順序獲取（一個接一個）
 */

import { infoLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { withRetry } from '../../utils/retry'; // Updated path to shared utils
import { fetchVideoDetail } from './fetch-video-detail';
import { VideoInfo, FetchVideoOptions } from '../../types'; // Use common VideoInfo
import { Page } from 'puppeteer';

/**
 * 批量處理多個影片 URL 的資訊獲取（順序處理，非並行）
 * @param videoUrls 影片 URL 陣列
 * @param cookie 抖音 Cookie 字串
 * @param options 獲取選項
 * @returns Promise<VideoInfoResult[]> 影片資訊結果陣列
 */
export async function processBatch(
  videoUrls: string[],
  page: Page, // Changed: Accept Page object
  // cookie: string, // Removed
  options: FetchVideoOptions = {}
): Promise<VideoInfo[]> { // Use common VideoInfo
  const { onProgress } = options;

  if (!videoUrls || videoUrls.length === 0) {
    logger.warn('沒有提供要處理的影片 URL');
    return [];
  }

  // Removed: Cookie check, assuming page is valid

  logger.info(`[processBatch] 開始順序處理 ${videoUrls.length} 個影片 URL（一個接一個）`);

  const results: (VideoInfo | null)[] = []; // Use common VideoInfo

  // 順序處理每個 URL（一個接一個）
  for (let index = 0; index < videoUrls.length; index++) {
    const url = videoUrls[index];
    logger.debug(`[processBatch] 處理第 ${index + 1}/${videoUrls.length} 個影片 URL: ${url}`);

    try {
      // 使用 withRetry 為每個任務添加重試機制
      const result = await withRetry(async () => {
        // Pass page instead of cookie to fetchVideoDetail
        return await fetchVideoDetail(page, url);
      }, { retries: 2 });

      // 在此記錄每個單獨的結果，方便調試
      if (result) {
        logger.debug(`[processBatch] 成功獲取影片資訊: ${result.title}`);
      } else {
        logger.debug(`[processBatch] 無法獲取影片資訊: ${url}`);
      }

      results.push(result);
    } catch (error) {
      logger.error(`[processBatch] 處理影片 URL 失敗: ${url}`, error instanceof Error ? error : new Error(String(error)));
      results.push(null);
    }

    // 更新進度
    if (onProgress) {
      logger.debug(`[processBatch] 批量處理進度: ${index + 1}/${videoUrls.length}`);
      onProgress(index + 1, videoUrls.length);
    }
  }

  // 過濾掉 null 結果
  const validResults = results.filter((result): result is VideoInfo => result !== null); // Use type predicate for filtering

  logger.info(`[processBatch] 批量處理完成，成功獲取 ${validResults.length}/${videoUrls.length} 個影片的資訊`);

  return validResults;
}