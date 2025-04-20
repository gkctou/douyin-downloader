// Copied from src/auth/cookie-path.ts
// Original file path: src/auth/cookie-path.ts
/**
 * Cookie 路徑管理
 * 提供跨平台的 Cookie 儲存路徑管理功能
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { CookieStorageError } from './errors';
import { authLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger

/**
 * 獲取應用程式資料目錄
 * 根據作業系統選擇適當的目錄
 * @returns 資料目錄路徑
 */
export function getAppDataDir(): string {
  const appName = 'dydl';
  let dir: string;

  switch (process.platform) {
    case 'win32':
      // Windows: %APPDATA%\\dydl
      if (process.env.APPDATA) {
        // 使用 Windows 風格的路徑分隔符
        dir = path.join(process.env.APPDATA, appName);
      } else {
        dir = path.join(os.homedir(), 'AppData', 'Roaming', appName);
      }
      break;
    case 'darwin':
      // macOS: ~/Library/Application Support/dydl
      dir = path.join(os.homedir(), 'Library', 'Application Support', appName);
      break;
    default:
      // Linux/其他: ~/.config/dydl
      dir = path.join(os.homedir(), '.config', appName);
  }

  return dir;
}

/**
 * 獲取預設 Cookie 檔案路徑
 * @returns Cookie 檔案的完整路徑
 */
export function getDefaultCookiePath(): string {
  return path.join(getAppDataDir(), 'cookie.txt');
}

/**
 * 確保 Cookie 目錄存在
 * @param path Cookie 檔案路徑
 * @returns Promise<void>
 * @throws {CookieStorageError} 如果創建目錄失敗
 */
export async function ensureCookieDirectory(cookiePath: string): Promise<void> {
  try {
    await fs.ensureDir(path.dirname(cookiePath));
    logger.debug(`已確保 Cookie 目錄存在: ${path.dirname(cookiePath)}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CookieStorageError(`無法創建 Cookie 目錄: ${errorMessage}`);
  }
}