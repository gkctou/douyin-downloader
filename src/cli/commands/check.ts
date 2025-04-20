/**
 * 檢查命令
 * 提供 'dydl check' 命令的實現
 */

import { Command } from 'commander';
// 使用 dynamic import 代替直接導入 ESM 模塊
// import ora from 'ora';
// import chalk from 'chalk';
import fs from 'fs';
import { getDefaultCookiePath, loadCookie, isValidCookie } from '../../douyin/auth'; // Corrected path
import { cliLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
// import { cleanupBrowser } from '../../utils/browser'; // Removed old cleanup

/**
 * 註冊檢查命令
 * @param program Commander 實例
 */
export function registerCheckCommand(program: Command): void {
  program
    .command('check')
    .description('檢查儲存的 Cookie 是否有效')
    .argument('[cookie-path]', '要檢查的 cookie 檔案路徑', getDefaultCookiePath())
    .action(async (cookiePath) => {
      logger.debug(`檢查命令執行，Cookie 路徑: ${cookiePath}`);
      
      // 動態導入 ESM 模塊
      const [{ default: ora }, { default: chalk }] = await Promise.all([
        import('ora'),
        import('chalk')
      ]);
      
      const spinner = ora('檢查 Cookie...').start();
      
      try {
        // 檢查檔案是否存在
        if (!fs.existsSync(cookiePath)) {
          spinner.fail(`Cookie 檔案不存在: ${cookiePath}`);
          console.log(chalk.yellow(`請執行 ${chalk.cyan('dydl login')} 先登入抖音`));
          return;
        }
        
        // 加載 Cookie
        const cookie = await loadCookie(cookiePath);
        if (!cookie) {
          spinner.fail(`Cookie 檔案為空: ${cookiePath}`);
          return;
        }
        
        // 驗證 Cookie
        spinner.text = '正在驗證 Cookie 有效性...';
        const isValid = await isValidCookie(cookie);
        
        if (isValid) {
          spinner.succeed(`Cookie 有效 (${cookiePath})`);
        } else {
          spinner.fail(`Cookie 已過期或無效`);
          console.log(chalk.yellow(`請執行 ${chalk.cyan('dydl login')} 重新登入抖音`));
        }
      } catch (error) {
        spinner.fail(`檢查 Cookie 時發生錯誤`);
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('檢查命令執行失敗:', err);
        console.error(chalk.red(err.message));
        process.exitCode = 1;
      }
      // Removed finally block with cleanupBrowser
    });
}