// Copied from src/download/video-downloader.ts
// Original file path: src/download/video-downloader.ts
/**
 * 影片下載核心功能
 * 實現單個影片的下載邏輯
 */

import fs from 'fs-extra';
import path from 'path';
import { downloadLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { downloadFile, ensureDirectoryExists } from '../../utils/file'; // Updated path to shared utils
import { VideoInfo } from '../../types'; // Use common VideoInfo
import { formatOutputPath } from './path-formatter'; // Keep formatOutputPath, remove ensureDirectoryExists
import { DownloadError, getDownloadErrorMessage } from './error-handler'; // Keep local error types for now
import { withRetry } from '../../utils/retry'; // Import withRetry from shared utils

/**
 * 下載選項
 */
export interface VideoDownloadOptions {
  retries?: number;                          // 下載失敗的重試次數，預設 3
  timeout?: number;                          // 請求超時時間（毫秒），預設 60000 (1分鐘)
  headers?: Record<string, string>;          // 自定義請求頭
  onProgress?: (progress: number) => void;   // Deprecated: Use onFileProgress for single file progress
  onFileProgress?: (progress: number) => void; // New callback for single file progress
  checkExisting?: boolean;                   // 是否檢查已存在的檔案，預設 true
  overwrite?: boolean;                       // 是否覆蓋已存在的檔案，預設 false
  useSubfolders?: boolean;                   // 是否按用戶名創建子文件夾，預設 true
  filenameTemplate?: string;                 // 檔名模板，預設 "{date}-{title}"
}

/**
 * 下載單個抖音影片
 * @param videoInfo 影片資訊
 * @param destPath 目標路徑（檔案或目錄）
 * @param options 下載選項
 * @returns Promise<string> 下載完成的檔案路徑
 */
export async function downloadVideo(
  videoInfo: VideoInfo, // Use common VideoInfo
  destPath: string,
  options: VideoDownloadOptions = {},
  downloadUrls?: string[] // 下載URL列表參數，可以是單個URL或URL列表
): Promise<string> {
  const {
    retries = 3,
    timeout = 60000,
    headers = {},
    onProgress, // Keep for backward compatibility? Or remove? Let's keep for now but prioritize onFileProgress
    onFileProgress, // Add the new option
    checkExisting = true,
    overwrite = false,
    useSubfolders = true,
    filenameTemplate = "{date}-{title}"
  } = options;

  let finalPath: string = ''; // Declare finalPath outside the try block

  try {
    // 檢查視頻播放 URL 是否存在
    if (!videoInfo.videoPlayUrl) {
      throw new DownloadError(
        `影片 ${videoInfo.id} 無有效的播放 URL`,
        videoInfo.id,
        'INVALID_URL',
        false
      );
    }

    // --- 確定最終的檔案路徑 ---
    // finalPath is already declared above
    const destPathStats = await fs.stat(destPath).catch(() => null);

    if (destPathStats && destPathStats.isDirectory()) {
        // destPath 是現有目錄，使用 formatOutputPath
        logger.debug(`destPath (${destPath}) 是現有目錄。使用 formatOutputPath。`);
        finalPath = formatOutputPath(videoInfo, destPath, { useSubfolders, filenameTemplate });
    } else if (!destPathStats && (destPath.endsWith(path.sep) || destPath.endsWith('/'))) {
         // destPath 不存在但以分隔符結尾，視為目錄
         logger.debug(`destPath (${destPath}) 不存在但以分隔符結尾。視為目錄並使用 formatOutputPath。`);
         finalPath = formatOutputPath(videoInfo, destPath, { useSubfolders, filenameTemplate });
    } else if (destPathStats && destPathStats.isFile()) {
        // destPath 是現有檔案 (可能來自 -f 或先前下載)
        logger.debug(`destPath (${destPath}) 是現有檔案。直接使用。`);
        finalPath = destPath; // 直接使用路徑
    } else if (!destPathStats) {
        // destPath 不存在，檢查父目錄
        const parentDir = path.dirname(destPath);
        // 檢查父目錄是否為空或根目錄，避免對根目錄調用 fs.stat
        let parentDirExists = false;
        if (parentDir && parentDir !== destPath) { // 確保 parentDir 不是自身 (例如 "/")
            try {
                const parentDirStats = await fs.stat(parentDir);
                parentDirExists = parentDirStats.isDirectory();
            } catch {
                parentDirExists = false;
            }
        } else if (parentDir === path.dirname(parentDir)) { // 檢查是否為根目錄 (e.g., '/' or 'C:\')
             parentDirExists = true; // 根目錄總是存在
        }


        if (parentDirExists) {
            // 父目錄存在，假定 destPath 是檔案路徑 (來自 -f)
            logger.debug(`destPath (${destPath}) 不存在，但父目錄存在。假定為檔案路徑並直接使用。`);
            finalPath = destPath; // 直接使用路徑
        } else {
            // 父目錄不存在，假定 destPath 是目錄路徑 (來自 -d 指定新目錄)
            logger.debug(`destPath (${destPath}) 及其父目錄不存在。視為目錄並使用 formatOutputPath。`);
            finalPath = formatOutputPath(videoInfo, destPath, { useSubfolders, filenameTemplate });
        }
    } else {
         // 不應發生，但預設為目錄行為
         logger.warn(`無法確定 destPath (${destPath}) 的類型。預設為目錄行為。`);
         finalPath = formatOutputPath(videoInfo, destPath, { useSubfolders, filenameTemplate });
    }
    // ---

    // 確保最終 finalPath 的父目錄存在
    await ensureDirectoryExists(path.dirname(finalPath));

    // 檢查檔案是否已存在
    if (checkExisting) {
      const fileExists = await fs.pathExists(finalPath);
      if (fileExists && !overwrite) {
        logger.info(`檔案已存在且不覆蓋: ${finalPath}`);
        return finalPath;
      } else if (fileExists) {
        logger.warn(`檔案已存在，將被覆蓋: ${finalPath}`);
      }
    }

    // 下載影片
    logger.info(`開始下載影片: ${videoInfo.title || videoInfo.id}`);
    logger.debug(`下載 URL: ${videoInfo.videoPlayUrl}`);
    logger.debug(`保存路徑: ${finalPath}`);

    // 設置請求頭
    const downloadHeaders = {
      'Referer': `https://www.douyin.com/video/${videoInfo.id}`,
      ...headers
    };

    // 使用重試機制下載
    // Use the imported withRetry from shared utils
    await withRetry(
      // Add type for progressCallback (assuming it's (progress: number) => void based on usage)
      // The function passed to withRetry doesn't receive progressCallback directly.
      // Progress should be handled via the options passed to downloadFile.
      async () => {
        await downloadFile(videoInfo.videoPlayUrl, finalPath, {
          headers: downloadHeaders,
          timeout,
          // Pass the correct callback (onFileProgress or onProgress) to downloadFile's onProgress
          onProgress: (downloaded: number, total?: number) => { // Match downloadFile's signature
            const progress = (total && total > 0) ? Math.round((downloaded / total) * 100) : 0;
            const fileProgressCallback = onFileProgress || onProgress; // Prioritize onFileProgress
            if (fileProgressCallback) {
              fileProgressCallback(progress);
            }
          }
        });
        return true;
      },
      // Options for withRetry
      {
        retries,
        onRetry: (error: Error, attempt: number) => {
          logger.warn(`下載影片 ${videoInfo.id} 失敗，重試 #${attempt}/${retries}:`, error.message);
        },
        // Example: Only retry on specific errors if needed
        shouldRetry: (error: Error) => {
            if (error instanceof DownloadError) {
                return error.isRetryable();
            }
            // Optionally retry other generic errors based on message, etc.
            return true; // Default: retry most errors
        }
      }
    );

    logger.info(`影片下載完成: ${finalPath}`);
    return finalPath;
  } catch (error) {
    const errorMessage = getDownloadErrorMessage(error, videoInfo.videoPlayUrl || videoInfo.id);
    logger.error(`下載影片 ${videoInfo.id} 失敗:`, new Error(errorMessage));

    // 如果檔案已經部分寫入，則刪除它
    // 使用上面已確定的 finalPath 變數
    try {
      // const finalPath = formatOutputPath(videoInfo, destPath, { // 不再需要重新計算
      //   useSubfolders,
      //   filenameTemplate
      // });

      if (await fs.pathExists(finalPath)) {
        await fs.unlink(finalPath);
        logger.debug(`刪除不完整的下載檔案: ${finalPath}`);
      }
    } catch (unlinkError) {
      logger.warn(`刪除不完整的檔案失敗:`, unlinkError);
    }

    // 嘗試使用下載URL列表
    if (downloadUrls && downloadUrls.length > 0) {
      // 使用第一個下載URL，並將剩餘的URL傳遞給遞迴調用
      const nextUrl = downloadUrls[0];
      const remainingUrls = downloadUrls.slice(1);

      logger.info(`嘗試使用其他下載URL下載影片 ${videoInfo.id}，剩餘 ${downloadUrls.length} 個下載URL`);

      // 創建一個新的videoInfo對象，使用下一個下載URL
      const newVideoInfo = { ...videoInfo, videoPlayUrl: nextUrl };

      // 遞迴調用自身，嘗試使用其他下載URL
      return await downloadVideo(newVideoInfo, destPath, options, remainingUrls);
    }

    throw new DownloadError(errorMessage, videoInfo.id, 'DOWNLOAD_FAILED', false);
  }
}

/**
 * 獲取影片的下載大小
 * @param url 影片 URL
 * @param headers 請求頭
 * @returns Promise<number> 檔案大小（位元組）
 */
export async function getVideoSize(
  url: string,
  headers: Record<string, string> = {}
): Promise<number> {
  try {
    // 發送 HEAD 請求獲取檔案大小
    const response = await fetch(url, {
      method: 'HEAD',
      headers
    });

    if (!response.ok) {
      throw new DownloadError(
        `獲取影片大小失敗: ${response.status} ${response.statusText}`,
        url,
        'HEAD_REQUEST_FAILED',
        true
      );
    }

    // 讀取 Content-Length 頭
    const contentLength = response.headers.get('content-length');
    if (!contentLength) {
      logger.warn(`無法獲取影片大小，伺服器未返回 Content-Length 頭: ${url}`);
      return 0;
    }

    // 轉換為數字
    const size = parseInt(contentLength, 10);
    if (isNaN(size)) {
      logger.warn(`無法解析影片大小: ${contentLength}, ${url}`);
      return 0;
    }

    return size;
  } catch (error) {
    if (error instanceof DownloadError) {
      throw error;
    }
    logger.error(`獲取影片大小失敗: ${url}`, error instanceof Error ? error : new Error(String(error)));
    throw new DownloadError(
      `獲取影片大小失敗: ${(error as Error).message}`,
      url,
      'GET_SIZE_FAILED',
      true
    );
  }
}