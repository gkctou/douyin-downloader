/**
 * 抖音 Cookie 儲存模組
 * 儲存 Cookie 到檔案
 * 
 * @remarks
 * 參考來源：此功能改寫自原本存放於 src/auth/cookie-storage.ts 的功能
 * 需要驗證：文件操作是否符合不同平台標準
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDefaultCookiePath } from './getDefaultCookiePath';

/**
 * 儲存 Cookie 到檔案
 * @param cookie Cookie 字串
 * @param cookiePath 可選的儲存路徑
 * 
 * @remarks
 * 基本的文件系統操作
 */
export async function saveCookie(cookie: string, cookiePath?: string): Promise<void> {
  try {
    // 如果未提供路徑，使用默認路徑
    const filePath = cookiePath || getDefaultCookiePath();
    
    // 確保目錄存在
    await ensureDirectoryExists(path.dirname(filePath));
    
    // 寫入 Cookie 到檔案
    await fs.promises.writeFile(filePath, cookie, 'utf-8');
    
    console.log(`Cookie 已保存至 ${filePath}`);
  } catch (error) {
    console.error('保存 Cookie 時發生錯誤:', error);
    throw new Error(`保存 Cookie 失敗: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 確保目錄存在，如不存在則創建
 * @param dirPath 目錄路徑
 * 
 * @remarks
 * 常見的文件操作輔助函數
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    // 檢查目錄是否存在
    await fs.promises.access(dirPath);
  } catch (error) {
    // 目錄不存在，創建目錄
    await fs.promises.mkdir(dirPath, { recursive: true });
    console.log(`已創建目錄: ${dirPath}`);
  }
} 