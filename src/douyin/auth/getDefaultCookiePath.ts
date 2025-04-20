/**
 * 抖音 Cookie 路徑模組
 * 獲取默認的 Cookie 存儲路徑
 * 
 * @remarks
 * 參考來源：此功能改寫自原本存放於 src/auth/cookie-path.ts 的功能
 * 需要驗證：標準路徑設置是否符合應用規範
 */

import * as os from 'os';
import * as path from 'path';

/**
 * 獲取應用數據目錄
 * @returns 資料目錄路徑
 * 
 * @remarks
 * 此功能與 getDefaultCookiePath 配合使用
 */
export function getAppDataDir(): string {
  // 應用名稱
  const appName = 'douyin-downloader';
  
  // 獲取用戶家目錄
  const homedir = os.homedir();
  
  // 根據作業系統決定應用數據目錄位置
  const platform = os.platform();
  
  let appDataDir: string;
  
  if (platform === 'win32') {
    // Windows: %APPDATA%\[appName]
    appDataDir = path.join(process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming'), appName);
  } else if (platform === 'darwin') {
    // macOS: ~/Library/Application Support/[appName]
    appDataDir = path.join(homedir, 'Library', 'Application Support', appName);
  } else {
    // Linux 和其他系統
    appDataDir = path.join(homedir, '.config', appName);
  }
  
  return appDataDir;
}

/**
 * 獲取默認的 Cookie 存儲路徑
 * @returns 根據作業系統返回默認的 Cookie 文件路徑
 * 
 * @remarks
 * 改寫自原本存放於 src/auth/cookie-path.ts 的功能
 */
export function getDefaultCookiePath(): string {
  // 應用數據目錄名稱
  const cookieFileName = 'douyin-cookie.txt';
  
  // 組合完整的 Cookie 檔案路徑
  return path.join(getAppDataDir(), cookieFileName);
} 