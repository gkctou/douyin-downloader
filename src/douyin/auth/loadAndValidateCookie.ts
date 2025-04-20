/**
 * 抖音 Cookie 讀取與驗證模組
 * 從檔案讀取 Cookie 並驗證有效性
 * 
 * @remarks
 * 參考來源：此功能改寫自原本存放於 src/auth/index.ts 的 loadAndValidateCookie 功能
 * 需要驗證：驗證流程是否符合抖音最新要求
 */

import { isValidCookie } from './isValidCookie';
import { loadCookie } from './loadCookie';

/**
 * 從檔案讀取 Cookie 並驗證有效性
 * @param cookiePath 可選的 Cookie 檔案路徑
 * @returns 有效的 Cookie 字串，如無效則返回空字串
 * 
 * @remarks
 * 整合了 Cookie 讀取和驗證功能
 */
export async function loadAndValidateCookie(cookiePath?: string): Promise<string> {
  try {
    // 從檔案讀取 Cookie
    const cookie = await loadCookie(cookiePath);
    
    if (!cookie) {
      console.warn('未找到 Cookie 檔案或檔案為空');
      return '';
    }
    
    // 驗證 Cookie 是否有效
    const isValid = await isValidCookie(cookie);
    
    if (!isValid) {
      console.warn('Cookie 已失效，需要重新登入');
      return '';
    }
    
    console.log('已載入有效的 Cookie');
    return cookie;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('驗證 Cookie 時發生錯誤:', errorMessage);
    return '';
  }
} 