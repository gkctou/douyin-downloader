/**
 * 通用檔案操作工具
 * 提供檔案系統操作功能，如下載檔案、獲取安全檔案名等
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os'; // Import os module
import { utilsLogger as logger } from './logger'; // Use the utils logger
import { enhancedFetch } from './fetch'; // Use the shared fetch

/**
 * 下載檔案
 * @param url 檔案 URL
 * @param destPath 目標路徑
 * @param options 下載選項
 * @returns Promise<string> 下載完成的檔案路徑
 */
export async function downloadFile(
  url: string,
  destPath: string,
  options: {
    headers?: Record<string, string>;
    timeout?: number;
    /**
     * 進度回調函數
     * @param downloaded 已下載的字節數
     * @param total 總字節數 (如果可用)
     */
    onProgress?: (downloaded: number, total?: number) => void;
  } = {}
): Promise<string> {
  let writer: fs.WriteStream | null = null;
  try {
    // 確保目錄存在
    await fs.ensureDir(path.dirname(destPath));

    // 創建寫入流
    writer = fs.createWriteStream(destPath);

    // 發送請求
    const response = await enhancedFetch(url, {
      headers: options.headers,
      timeout: options.timeout
    });

    if (!response.ok) {
      throw new Error(`下載失敗: ${response.status} ${response.statusText}`);
    }

    // 獲取總大小
    const contentLength = response.headers.get('content-length');
    const totalSize = contentLength ? parseInt(contentLength, 10) : undefined;

    let downloaded = 0;

    // 如果響應體不是可讀流，則直接寫入
    if (!response.body) {
      const buffer = await response.arrayBuffer();
      writer.write(Buffer.from(buffer));
      writer.end();

      if (options.onProgress && totalSize !== undefined) {
        options.onProgress(totalSize, totalSize);
      }

      return destPath;
    }

    // 創建讀取流
    const reader = response.body.getReader();

    // 處理進度
    const processChunk = async (): Promise<void> => {
      const { done, value } = await reader.read();

      if (done) {
        // Ensure writer is closed before resolving
        return new Promise((resolve) => {
            if (writer) {
                writer.end(resolve);
            } else {
                resolve();
            }
        });
      }

      if (value) {
        downloaded += value.length;
        // Wait for the write to complete to handle backpressure
        await new Promise<void>((resolve, reject) => {
            if (writer) {
                writer.write(Buffer.from(value), (err) => {
                    if (err) reject(err); else resolve();
                });
            } else {
                reject(new Error("Writer is not available"));
            }
        });


        if (options.onProgress) {
          options.onProgress(downloaded, totalSize);
        }
      }

      return processChunk();
    };

    await processChunk();
    logger.debug(`檔案已下載至 ${destPath}`);

    return destPath;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`下載檔案 ${url} 至 ${destPath} 失敗:`, err);

    // 確保關閉寫入流
    if (writer && !writer.closed) {
        writer.close();
    }

    // 如果檔案已經創建但下載失敗，則刪除它
    try {
      if (await fs.pathExists(destPath)) {
        await fs.unlink(destPath);
        logger.debug(`刪除不完整的下載檔案: ${destPath}`);
      }
    } catch (unlinkError) {
      const unlinkErr = unlinkError instanceof Error ? unlinkError : new Error(String(unlinkError));
      logger.error(`刪除不完整的下載檔案 ${destPath} 失敗:`, unlinkErr);
    }

    throw new Error(`下載檔案失敗: ${err.message}`);
  }
}

/**
 * 獲取安全的檔案名（替換非法字符）
 * @param filename 原始檔案名
 * @returns 安全的檔案名
 */
export function getSafeFilename(filename: string): string {
  if (!filename) return 'untitled';
  // 替換非法字符
  return filename
    .replace(/[\\/:*?"<>|]/g, '_') // 替換 Windows/Unix 不允許的字符
    .replace(/\s+/g, ' ') // 將連續空白字符替換為單個空格
    .trim() // 去除首尾空白字符
    .slice(0, 200); // Limit filename length to avoid issues
}

/**
 * 建立帶有時間戳的檔案名
 * @param name 檔案名（不含副檔名）
 * @param ext 副檔名（不含句點）
 * @returns 格式化的檔案名
 */
export function getTimestampedFilename(name: string, ext: string): string {
  const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
  const safeName = getSafeFilename(name);
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, ''); // Sanitize extension
  return `${timestamp}-${safeName}.${safeExt}`;
}

/**
 * 確保目錄存在，如果不存在則創建
 * @param dirPath 目錄路徑
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
        await fs.ensureDir(dirPath);
        logger.debug(`目錄已確保存在: ${dirPath}`);
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(`創建目錄 ${dirPath} 失敗:`, err);
        // Consider throwing a specific AppError here
        throw new Error(`無法創建目錄 ${dirPath}: ${err.message}`);
    }
}

/**
 * 獲取應用數據目錄
 * 根據作業系統選擇適當的目錄
 * @param appName 應用程式名稱，用於創建子目錄
 * @returns 資料目錄路徑
 */
export function getAppDataDir(appName: string = 'douyin-downloader'): string {
  let dir: string;
  const homedir = os.homedir();

  switch (process.platform) {
    case 'win32':
      // Windows: %APPDATA%\[appName]
      dir = path.join(process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming'), appName);
      break;
    case 'darwin':
      // macOS: ~/Library/Application Support/[appName]
      dir = path.join(homedir, 'Library', 'Application Support', appName);
      break;
    default:
      // Linux/其他: ~/.config/[appName] or ~/.local/share/[appName]
      dir = path.join(process.env.XDG_CONFIG_HOME || path.join(homedir, '.config'), appName);
      // Fallback to .local/share if .config doesn't exist or isn't standard?
      // Or just stick to .config as a common practice.
      break;
  }
  return dir;
}