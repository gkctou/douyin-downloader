// Copied from src/download/download-manager.ts
// Original file path: src/download/download-manager.ts
/**
 * 並行下載管理器
 * 實現多個影片的並行下載和進度追蹤
 */

import { VideoInfo, DownloadResult as CommonDownloadResult } from '../../types'; // Correct import
import { downloadVideo, VideoDownloadOptions } from './video-downloader';
import { processBatch } from '../../utils/retry'; // Updated path to shared utils
import { downloadLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger

/**
 * 下載結果
 */
// No local DownloadResult needed, use CommonDownloadResult directly

/**
 * 批量下載選項
 */
export interface BatchDownloadOptions extends VideoDownloadOptions {
  concurrency?: number;  // 並行下載的數量，預設 3
  onBatchProgress?: (current: number, total: number, overallProgress: number) => void; // 批量進度回調
}

/**
 * 並行下載多個抖音影片
 * @param videoInfoList 影片資訊列表
 * @param outputPath 輸出路徑
 * @param options 下載選項
 * @returns Promise<DownloadResult[]> 下載結果列表
 */
export async function downloadBatch(
  videoInfoList: VideoInfo[], // Use common VideoInfo
  outputPath: string,
  options: BatchDownloadOptions = {}
): Promise<CommonDownloadResult[]> { // Return the common type
  const { concurrency = 3, onBatchProgress, ...videoOptions } = options;
  const total = videoInfoList.length;

  logger.info(`開始下載 ${total} 個影片，並行數量: ${concurrency}`);

  // 用於追蹤每個影片的進度
  const progressMap = new Map<number, number>();

  // 更新總體進度的函數
  const updateOverallProgress = () => {
    if (!onBatchProgress) return;

    // 計算總體進度百分比
    let totalProgress = 0;

    progressMap.forEach((progress) => {
      totalProgress += progress;
    });

    const overallProgress = progressMap.size > 0
      ? Math.round(totalProgress / progressMap.size)
      : 0;

    // 回調總體進度
    onBatchProgress(progressMap.size, total, overallProgress);
  };

  // 使用 withConcurrency 並行下載
  // Use processBatch with correct types and handle its return value { results, errors }
  const batchOutcome = await processBatch<VideoInfo, CommonDownloadResult>(
    videoInfoList,
    async (videoInfo: VideoInfo, index: number) => { // Use VideoInfo type
      try {
        // 為每個影片創建獨立的進度回調
        const onProgress = (progress: number) => {
          progressMap.set(index, progress);
          updateOverallProgress();
        };

        // 下載影片
        // Use onFileProgress from videoOptions if available
        const filePath = await downloadVideo(videoInfo, outputPath, {
          ...videoOptions,
          onFileProgress: onProgress // Pass the per-item progress callback to onFileProgress
        });
        // Removed the download_url logic as it's not in common VideoInfo

        // 下載成功，設置進度為 100%
        progressMap.set(index, 100);
        updateOverallProgress();

        // Return structure matching CommonDownloadResult
        const result: CommonDownloadResult = {
          videoInfo,
          success: true,
          filePath
        };
        return result;
      } catch (error) {
        // 下載失敗，記錄錯誤
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error(`下載影片 ${videoInfo.id} 失敗:`, errorObj);

        // Return structure matching CommonDownloadResult for failure case
        const result: CommonDownloadResult = {
          videoInfo,
          success: false,
          error: errorObj // Use the captured error object
        };
        return result;
      }
    },
    {
      concurrency,
      retries: 0, // 在 downloadVideo 中已經有重試機制
      onProgress: (current: number, total: number) => {
        if (onBatchProgress) {
          // 這裡只更新完成的影片數量，不包含進度百分比
          const overallProgress = progressMap.size > 0
            ? Math.round(Array.from(progressMap.values()).reduce((sum, p) => sum + p, 0) / progressMap.size)
            : 0;

          onBatchProgress(current, total, overallProgress);
        }
      }
    }
  ); // batchOutcome is { results: CommonDownloadResult[], errors: Error[] }

  // 統計成功和失敗數量
  // Extract results and errors
  const successfulDownloads = batchOutcome.results;
  const downloadErrors = batchOutcome.errors;

  const successCount = successfulDownloads.length;
  const failCount = total - successCount; // Or use downloadErrors.length

  logger.info(`下載完成，成功: ${successCount}/${total}，失敗: ${failCount}/${total}`);
  if (downloadErrors.length > 0) {
      logger.warn(`下載過程中發生 ${downloadErrors.length} 個錯誤`);
  }

  // Return the array of successful download results
  return successfulDownloads;
}