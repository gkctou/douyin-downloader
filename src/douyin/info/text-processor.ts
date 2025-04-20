// Copied from src/info/text-processor.ts
// Original file path: src/info/text-processor.ts
/**
 * 文本解析與處理
 * 結合連結解析模組，實現從文本中提取並獲取影片資訊
 */

import { infoLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { parseDouyinLinks } from '../parser'; // Corrected path
import { processBatch } from './batch-processor';
import { VideoInfo, FetchVideoOptions, ParseResult } from '../../types'; // Use common VideoInfo
import { Page } from 'puppeteer';

/**
 * 從文本內容中提取抖音連結並獲取影片資訊
 * @param text 包含抖音連結的文本
 * @param cookie 抖音 Cookie 字串
 * @param options 獲取選項
 * @returns Promise<VideoInfoResult[]> 影片資訊結果陣列
 */
export async function processTextContent(
  text: string,
  page: Page, // Changed: Accept Page object
  // cookie: string, // Removed
  options: FetchVideoOptions = {}
): Promise<VideoInfo[]> { // Use common VideoInfo
  logger.debug('[processTextContent] 開始從文本中提取抖音連結');

  // 使用連結解析模組從文本中提取抖音連結
  const parseResults = await parseDouyinLinks(text, {
    concurrency: options.concurrency,
    onProgress: options.onProgress
  });

  if (parseResults.length === 0) {
    logger.warn('未從文本中找到有效的抖音連結');
    return [];
  }

  logger.info(`[processTextContent] 從文本中找到 ${parseResults.length} 個抖音連結，開始獲取詳細資訊`);

  // 獲取標準 URL 陣列
  const videoUrls = parseResults.map((result: ParseResult) => result.standardUrl);

  // 使用批量處理功能獲取影片資訊
  const results = await processBatch(videoUrls, page, options); // Pass page instead of cookie

  // 檢查是否有失敗的獲取
  if (results.length < videoUrls.length) {
    const failedCount = videoUrls.length - results.length;
    logger.warn(`[processTextContent] 無法獲取影片資訊: ${failedCount} 個影片獲取失敗`, 'fetchVideoDetail 返回 null');
  }

  // 直接返回處理結果，不添加額外屬性
  logger.info(`[processTextContent] 文本處理完成，成功獲取 ${results.length} 個影片的資訊`);

  return results;
}