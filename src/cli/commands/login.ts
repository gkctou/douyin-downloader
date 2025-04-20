/**
 * 登入命令
 * 提供 'dydl login' 命令的實現
 */

import { Command } from 'commander';
// 使用 dynamic import 代替直接導入 ESM 模塊
// import ora from 'ora';
// import chalk from 'chalk';
import { login, LoginOptions } from '../../douyin/auth'; // Corrected path, import LoginOptions
import { getDefaultCookiePath } from '../../douyin/auth'; // Corrected path (getDefaultCookiePath is in auth)
import { cliLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { cleanupBrowser } from '../../utils/browser'; // Updated path to shared utils
import * as fs from 'fs'; // 引入 fs 模組用於讀取檔案
import * as path from 'path'; // 引入 path 模組用於處理路徑

/**
 * 註冊登入命令
 * @param program Commander 實例
 */
export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('登入抖音並儲存 Cookie')
    .argument('[cookie-path]', '儲存 cookie 的檔案路徑', getDefaultCookiePath())
    .option('-l, --load-cookie <cookie>', '載入初始 Cookie (可以是字串或檔案路徑)')
    .action(async (cookiePath, options) => { // 接收 options
      logger.debug(`登入命令執行，Cookie 儲存路徑: ${cookiePath}`);
      logger.debug(`CLI 選項: ${JSON.stringify(options)}`);

      // 動態導入 ESM 模塊 (移到最前面)
      const [{ default: ora }, { default: chalk }] = await Promise.all([
        import('ora'),
        import('chalk')
      ]);

      let initialCookieString: string | undefined = undefined;

      // --- 處理 --load-cookie 選項 ---
      if (options.loadCookie) {
        const loadCookieValue = options.loadCookie;
        try {
          // 嘗試判斷是否為檔案路徑
          if (fs.existsSync(loadCookieValue) && fs.statSync(loadCookieValue).isFile()) {
            logger.info(`偵測到 --load-cookie 為檔案路徑，正在讀取: ${loadCookieValue}`);
            initialCookieString = fs.readFileSync(loadCookieValue, 'utf-8').trim();
            if (initialCookieString) { // 檢查是否已定義
              logger.debug(`從檔案讀取的 Cookie: ${initialCookieString.substring(0, 50)}...`); // 只記錄部分 Cookie
            }
          } else {
            logger.info(`將 --load-cookie 視為 Cookie 字串`);
            initialCookieString = loadCookieValue.trim();
          }
        } catch (err) {
          const readErr = err instanceof Error ? err : new Error(String(err));
          logger.error(`處理 --load-cookie (${loadCookieValue}) 時發生錯誤: ${readErr.message}`);
          // 在這裡使用 chalk 前確保它已被載入
          console.error(chalk.red(`錯誤：無法讀取或處理 --load-cookie 指定的值: ${loadCookieValue}`));
          process.exit(1);
        }
      }
      // --- 結束處理 --load-cookie 選項 ---

      // --- 自動載入 cookiePath (如果存在且未通過 --load-cookie 指定) ---
      if (initialCookieString === undefined) {
          try {
              if (fs.existsSync(cookiePath) && fs.statSync(cookiePath).isFile()) {
                  logger.info(`未指定 --load-cookie，但找到現有 Cookie 檔案，正在載入: ${cookiePath}`);
                  initialCookieString = fs.readFileSync(cookiePath, 'utf-8').trim();
                  if (initialCookieString) {
                      logger.debug(`從檔案 ${cookiePath} 讀取的 Cookie: ${initialCookieString.substring(0, 50)}...`);
                  } else {
                      logger.warn(`現有 Cookie 檔案 ${cookiePath} 為空`);
                  }
              }
          } catch (err) {
              const readErr = err instanceof Error ? err : new Error(String(err));
              logger.warn(`嘗試自動載入現有 Cookie 檔案 ${cookiePath} 時發生錯誤: ${readErr.message}`);
              // 不終止程序，允許繼續無初始 Cookie 的登入
          }
      }
      // --- 結束自動載入 cookiePath ---

      const spinner = ora('準備登入抖音...').start();

      try {
        spinner.info(`即將開啟瀏覽器，請在瀏覽器中完成登入`);
        spinner.text = '等待登入中，請在瀏覽器中完成登入...';
        spinner.start();

        // 準備登入選項
        const loginOpts: LoginOptions = {
          initialCookie: initialCookieString,
          // 可以根據需要從 CLI 選項傳遞其他參數，例如 headless
          // headless: options.headless // 假設有 --headless 選項
        };

        // 執行登入，傳遞儲存路徑和選項
        const cookie = await login(cookiePath, loginOpts);

        // login 函數現在可能返回 string 或 LoginResult，但在此 CLI 情境下，autoCleanup 預設為 true，應只返回 string
        if (typeof cookie === 'string' && cookie) {
          spinner.succeed(`登入成功！Cookie 已儲存至 ${cookiePath}`);
          console.log(chalk.green('✔') + ' 現在可以使用其他命令下載影片');
        } else {
          spinner.fail('登入失敗，未能獲取有效的 Cookie');
        }
      } catch (error) {
        spinner.fail('登入過程中發生錯誤');
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('登入命令執行失敗:', err);
        // 在這裡使用 chalk 前確保它已被載入
        console.error(chalk.red(err.message));
        process.exitCode = 1;
      } finally {
        // 確保在登入完成後清理瀏覽器資源，讓程序可以正常退出
        try {
          await cleanupBrowser();
          logger.debug('已清理瀏覽器資源');
        } catch (cleanupError: unknown) {
          const err = cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError));
          logger.error('清理瀏覽器資源失敗:', err);
        }
      }
    });
}