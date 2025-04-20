/**
 * CLI 工具函數
 * 提供 CLI 相關的輔助功能
 */

import fs from 'fs';
import path from 'path';
// 使用動態導入代替靜態導入
// import chalk from 'chalk';
// import ora from 'ora';
import { getDefaultCookiePath, loadCookie, isValidCookie } from '../douyin/auth'; // Corrected path
import { cliLogger as logger } from '../utils/logger'; // Updated path to shared utils logger

/**
 * 獲取套件版本
 * @returns 版本號
 */
export function getVersion(): string {
  try {
    // 嘗試多個可能的路徑來找到 package.json
    const possiblePaths = [
      // 開發環境路徑：相對於 src/cli/utils.ts 的路徑
      path.resolve(__dirname, '../../package.json'),
      
      // 生產環境路徑：相對於 dist/cli/utils.js 的路徑
      path.resolve(__dirname, '../../../package.json'),
      
      // 絕對路徑：從專案根目錄開始
      path.resolve(process.cwd(), 'package.json')
    ];
    
    // 嘗試每個路徑，直到找到有效的 package.json
    let packageJson;
    for (const packageJsonPath of possiblePaths) {
      if (fs.existsSync(packageJsonPath)) {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        logger.debug(`找到 package.json: ${packageJsonPath}`);
        break;
      }
    }
    
    if (!packageJson) {
      logger.warn('無法找到 package.json 文件');
      return '0.0.0';
    }
    
    return packageJson.version || '0.0.0';
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('無法獲取套件版本:', err);
    return '0.0.0';
  }
}

/**
 * 檢查 Cookie 是否存在並有效
 * @param cookiePath 可選的 Cookie 檔案路徑
 * @param quiet 是否安靜模式（不顯示提示）
 * @returns Promise<string> 有效的 Cookie 字串或空字串
 */
export async function checkAndGetCookie(
  cookiePath?: string,
  quiet: boolean = false
): Promise<string> {
  // 動態導入 ESM 模塊
  const [{ default: ora }, { default: chalk }] = await Promise.all([
    import('ora'),
    import('chalk')
  ]);
  
  const spinner = !quiet ? ora('檢查 Cookie...').start() : null;
  
  try {
    // 確定 Cookie 路徑
    const finalPath = cookiePath || getDefaultCookiePath();
    
    // 檢查檔案是否存在
    if (!fs.existsSync(finalPath)) {
      spinner?.fail(`Cookie 檔案不存在: ${finalPath}`);
      if (!quiet) {
        console.log(chalk.yellow(`請執行 ${chalk.cyan('dydl login')} 先登入抖音`));
      }
      return '';
    }
    
    // 加載 Cookie
    const cookie = await loadCookie(finalPath);
    if (!cookie) {
      spinner?.fail(`Cookie 檔案為空: ${finalPath}`);
      return '';
    }
    
    // 驗證 Cookie
    const isValid = await isValidCookie(cookie);
    
    if (isValid) {
      if (!quiet) { // Only show success message if not in quiet mode
        spinner?.succeed(`Cookie 有效`);
      }
      return cookie;
    } else {
      spinner?.fail(`Cookie 已過期或無效`);
      if (!quiet) {
        console.log(chalk.yellow(`請執行 ${chalk.cyan('dydl login')} 重新登入抖音`));
      }
      return '';
    }
  } catch (error) {
    spinner?.fail(`檢查 Cookie 時發生錯誤`);
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('檢查 Cookie 失敗:', err);
    return '';
  }
}

/**
 * 格式化進度顯示
 * @param current 當前進度
 * @param total 總數
 * @param width 進度條寬度
 * @returns 格式化的進度條字串
 */
export function formatProgress(current: number, total: number, width: number = 30): string {
  const percent = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
  const filledWidth = Math.round(width * (percent / 100));
  const emptyWidth = width - filledWidth;
  
  const filledBar = '█'.repeat(filledWidth);
  const emptyBar = '░'.repeat(emptyWidth);
  
  return `${filledBar}${emptyBar} ${percent}% (${current}/${total})`;
}

/**
 * 創建進度處理器
 * @param spinner Ora 實例
 * @param message 進度消息前綴
 * @returns 進度回調函數
 */
export async function createProgressHandler(
  spinner: any,
  message: string
): Promise<(current: number, total: number, progress?: number) => void> {
  return (current: number, total: number, progress?: number) => {
    const progressBar = formatProgress(current, total);
    const percentText = progress !== undefined ? ` ${Math.round(progress)}%` : '';
    spinner.text = `${message} ${progressBar}${percentText}`;
  };
}