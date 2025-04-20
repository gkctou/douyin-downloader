// Copied from src/auth/cookie-storage.ts
// Original file path: src/auth/cookie-storage.ts
/**
 * Cookie 儲存與讀取
 * 提供 Cookie 檔案操作功能
 */

import fs from 'fs-extra';
import { getDefaultCookiePath, ensureCookieDirectory } from './cookie-path';
import { CookieStorageError } from './errors';
import { authLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger

/**
 * 儲存 Cookie 到檔案
 * @param cookieString Cookie 字串
 * @param path 檔案路徑，如未指定則使用預設路徑
 * @returns Promise<string> 儲存成功的檔案路徑
 * @throws {CookieStorageError} 如果儲存失敗
 */
export async function saveCookie(cookieString: string, filePath?: string): Promise<string> {
  const cookiePath = filePath || getDefaultCookiePath();

  try {
    // 確保目錄存在
    await ensureCookieDirectory(cookiePath);

    // 寫入 Cookie
    await fs.writeFile(cookiePath, cookieString, 'utf-8');
    logger.debug(`Cookie 已儲存至 ${cookiePath}`);

    return cookiePath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CookieStorageError(`無法儲存 Cookie 至 ${cookiePath}: ${errorMessage}`);
  }
}

/**
 * 從檔案加載 Cookie
 * @param filePath 檔案路徑，如未指定則使用預設路徑
 * @returns Promise<string> Cookie 字串，或在檔案不存在時返回空字串
 * @throws {CookieStorageError} 如果讀取失敗
 */
export async function loadCookie(filePath?: string): Promise<string> {
  const cookiePath = filePath || getDefaultCookiePath();

  try {
    // 檢查檔案是否存在
    if (await fs.pathExists(cookiePath)) {
      const cookie = await fs.readFile(cookiePath, 'utf-8');
      logger.debug(`已從 ${cookiePath} 載入 Cookie`);
      return cookie.trim();
    } else {
      logger.warn(`Cookie 檔案不存在: ${cookiePath}`);
      return '';
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CookieStorageError(`無法讀取 Cookie 從 ${cookiePath}: ${errorMessage}`);
  }
}