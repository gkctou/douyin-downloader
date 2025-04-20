// Copied from src/auth/index.ts
// Original file path: src/auth/index.ts
/**
 * 認證模組
 * 提供抖音登入和 Cookie 管理功能
 */

import { login as browserLogin, LoginOptions, LoginResult } from './login';
import { isValidCookie } from './validate';
import { getDefaultCookiePath } from './cookie-path';
import { loadCookie, saveCookie } from './cookie-storage';
import { authLogger as logger } from '../../utils/logger'; // Updated path to shared utils

export * from './errors';
export { getDefaultCookiePath, ensureCookieDirectory, getAppDataDir } from './cookie-path';
export { saveCookie, loadCookie } from './cookie-storage';
export { login } from './login';
export type { LoginOptions, LoginResult } from './login';
export { isValidCookie } from './validate';

/**
 * 從檔案讀取 Cookie 並驗證有效性
 * @param cookiePath 可選的 Cookie 檔案路徑
 * @returns Promise<string> 有效的 Cookie 字串，如無效則返回空字串
 */
export async function loadAndValidateCookie(cookiePath?: string): Promise<string> {
  // 加載 Cookie
  const cookie = await loadCookie(cookiePath);

  if (!cookie) {
    logger.warn('未找到 Cookie 檔案或檔案為空');
    return '';
  }

  // 驗證 Cookie
  try {
    const isValid = await isValidCookie(cookie);

    if (!isValid) {
      logger.warn('Cookie 已失效，需要重新登入');
      return '';
    }

    logger.info('已載入有效的 Cookie');
    return cookie;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('驗證 Cookie 時發生錯誤:', err);
    return '';
  }
}