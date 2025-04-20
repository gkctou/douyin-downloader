/**
 * 抖音 Cookie 讀取模組
 * 從檔案讀取 Cookie
 * 
 * @remarks
 * 參考來源：此功能改寫自原本存放於 src/auth/cookie-storage.ts 的功能
 * 需要驗證：文件操作是否符合不同平台標準
 */

import * as fs from 'fs';
import { getDefaultCookiePath } from './getDefaultCookiePath';

/**
 * 從檔案讀取 Cookie
 * @param cookiePath 可選的 Cookie 檔案路徑
 * @returns Cookie 字串，如檔案不存在則返回空字串
 * 
 * @remarks
 * 基本的文件系統操作
 */
export async function loadCookie(cookiePath?: string): Promise<string> {
  try {
    // 如果未提供路徑，使用默認路徑
    const filePath = cookiePath || getDefaultCookiePath();
    
    // 嘗試讀取檔案
    const cookieString = await fs.promises.readFile(filePath, 'utf-8');
    
    if (!cookieString || cookieString.trim() === '') {
      console.warn(`Cookie 檔案 ${filePath} 存在但為空`);
      return '';
    }
    
    console.log(`已從 ${filePath} 讀取 Cookie`);
    return cookieString.trim();
  } catch (error) {
    // 如果檔案不存在，返回空字串
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`Cookie 檔案不存在: ${cookiePath || getDefaultCookiePath()}`);
      return '';
    }
    
    // 其他錯誤
    console.error('讀取 Cookie 時發生錯誤:', error);
    return '';
  }
} 