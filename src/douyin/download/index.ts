// Copied from src/download/index.ts
// Original file path: src/download/index.ts
/**
 * 影片下載模組
 * 提供下載抖音影片的功能
 */

import fs from 'fs-extra';
import path from 'path';
import { downloadLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { fetchVideosInfoText, fetchVideosInfoUrls } from '../info'; // Keep relative path within douyin
import { parseDouyinLinks } from '../parser'; // Keep relative path within douyin
import { VideoInfo, DownloadOptions, ParseResult, DownloadResult as CommonDownloadResult } from '../../types'; // Use VideoInfo, import CommonDownloadResult
import { downloadVideo, VideoDownloadOptions } from './video-downloader'; // Keep VideoDownloadOptions import
import { downloadBatch } from './download-manager'; // Remove DownloadResult import
import { ensureDirectoryExists } from '../../utils/file'; // Updated path to shared utils
import { Page } from 'puppeteer';

// 重新導出子模組
export * from './video-downloader';
export * from './download-manager';
export * from './path-formatter';
export * from './error-handler';

/**
 * 下載多個抖音影片
 * @param videoInfos 影片資訊陣列
 * @param outputPath 輸出路徑
 * @param options 下載選項
 * @returns Promise<DownloadResult[]> 下載結果陣列
 */
export async function downloadVideos(
  videoInfos: VideoInfo[], // Use common VideoInfo
  outputPath: string,
  options: DownloadOptions = {}
): Promise<CommonDownloadResult[]> { // Use CommonDownloadResult
  // Destructure all potential options from the input DownloadOptions
  const {
    concurrency = 3,
    retries = 3,
    onProgress,
    timeout,
    // headers are not part of DownloadOptions in types.ts, but are in VideoDownloadOptions
    // checkExisting is not part of DownloadOptions in types.ts, but are in VideoDownloadOptions
    overwrite,
    useSubfolders,
    filenameTemplate
  } = options;

  // 目錄確保邏輯已移至 CLI 或 downloadBatch/downloadVideo
  // await ensureDirectoryExists(path.isAbsolute(outputPath)
  //   ? outputPath
  //   : path.resolve(process.cwd(), outputPath));

  logger.info(`開始下載 ${videoInfos.length} 個影片`);

  // 使用下載批次處理器
  // Explicitly construct the options object for downloadBatch using an intersection type
  const batchOptions: VideoDownloadOptions & {
    concurrency?: number;
    onBatchProgress?: (current: number, total: number, overallProgress: number) => void;
  } = {
    concurrency,
    retries, // Pass retries (should be valid via VideoDownloadOptions)
    onBatchProgress: onProgress, // Map the batch progress callback
    // Pass other relevant options inherited from VideoDownloadOptions
    timeout: timeout,
    // headers: headers, // headers not available in input options
    // checkExisting: checkExisting, // checkExisting not available in input options
    overwrite: overwrite,
    useSubfolders: useSubfolders,
    filenameTemplate: filenameTemplate
  };
  const results = await downloadBatch(videoInfos, outputPath, batchOptions);

  // 統計結果
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  logger.info(`下載完成，成功: ${successCount}/${videoInfos.length}，失敗: ${failCount}/${videoInfos.length}`);

  return results;
}

/**
 * 從 URL 陣列下載抖音影片
 * @param videoUrls 影片 URL 陣列
 * @param outputPath 輸出路徑
 * @param cookie 有效的抖音 Cookie
 * @param options 下載選項
 * @returns Promise<string[]> 下載完成的檔案路徑陣列
 */
export async function downloadVideosFromUrls(
  videoUrls: string[],
  outputPath: string,
  page: Page, // Changed: Accept Page object
  // cookie: string, // Removed
  options: DownloadOptions = {}
): Promise<string[]> {
  // 獲取影片資訊
  logger.info(`[downloadVideosFromUrls] 開始獲取 ${videoUrls.length} 個影片的資訊`);
  // Pass page instead of cookie
  const videoInfos = await fetchVideosInfoUrls(videoUrls, page, {
    concurrency: options.concurrency,
    onProgress: options.onProgress
      ? (current: number, total: number, overallProgress?: number) => options.onProgress!(current, total, overallProgress !== undefined ? overallProgress * 0.2 : undefined) // Adjust progress, handle undefined
      : undefined
  });

  if (videoInfos.length === 0) {
    logger.warn('[downloadVideosFromUrls] 未找到有效的影片資訊，無法下載');
    return [];
  }

  logger.info(`[downloadVideosFromUrls] 成功獲取 ${videoInfos.length} 個影片的資訊，開始下載`);

  // 下載影片
  const results = await downloadVideos(videoInfos, outputPath, {
    ...options,
    onProgress: options.onProgress
      ? (current, total, overallProgress) => {
          // 調整進度：資訊獲取 0-20%，下載 20-100%
          const adjustedProgress = overallProgress !== undefined ? 20 + (overallProgress * 0.8) : undefined; // Adjust progress, handle undefined
          options.onProgress!(current, total, adjustedProgress);
        }
      : undefined
  });

  // 過濾出成功的結果，返回檔案路徑
  return results
    .filter(result => result.success && result.filePath)
    .map(result => result.filePath!) as string[];
}

/**
 * 從文本中解析抖音連結並下載影片
 * @param text 包含抖音連結的文本
 * @param outputPath 輸出路徑
 * @param cookie 有效的抖音 Cookie
 * @param options 下載選項
 * @returns Promise<string[]> 下載完成的檔案路徑陣列
 */
export async function downloadVideosFromText(
  text: string,
  outputPath: string,
  page: Page, // Changed: Accept Page object
  // cookie: string, // Removed
  options: DownloadOptions = {}
): Promise<string[]> {
  // 解析文本中的抖音連結
  logger.info('[downloadVideosFromText] 解析文本中的抖音連結');
  const parseResults = await parseDouyinLinks(text, {
    concurrency: options.concurrency,
    retries: options.retries,
    onProgress: options.onProgress
      ? (current: number, total: number, overallProgress?: number) => options.onProgress!(current, total, overallProgress !== undefined ? overallProgress * 0.1 : undefined) // Adjust progress, handle undefined
      : undefined
  });

  if (parseResults.length === 0) {
    logger.warn('[downloadVideosFromText] 未找到有效的抖音影片連結');
    return [];
  }

  // 獲取標準 URL 陣列
  const videoUrls = parseResults.map((result: ParseResult) => result.standardUrl);
  logger.info(`[downloadVideosFromText] 找到 ${videoUrls.length} 個有效連結，開始獲取影片資訊`);

  // 下載影片
  // Pass page instead of cookie
  return downloadVideosFromUrls(videoUrls, outputPath, page, {
    ...options,
    onProgress: options.onProgress
      ? (current, total, overallProgress) => {
          // 調整進度：解析連結 0-10%，下載 10-100%
          const adjustedProgress = overallProgress !== undefined ? 10 + (overallProgress * 0.9) : undefined; // Adjust progress, handle undefined
          options.onProgress!(current, total, adjustedProgress);
        }
      : undefined
  });
}