/**
 * Open 命令
 * 提供 'dydl open' 命令的實現，用於打開一個已載入 Cookie 的瀏覽器。
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { cliLogger as logger } from '../../utils/logger';
import { getDefaultCookiePath, loadCookie } from '../../douyin/auth';
import { launchBrowser, newPage, setCookiesOnPage, LaunchOptions, closeBrowser } from '../../douyin/browser/manager';
import { Browser } from 'puppeteer';

/**
 * 註冊 Open 命令
 * @param program Commander 實例
 */
export function registerOpenCommand(program: Command): void {
  program
    .command('open')
    .description('打開一個已載入 Cookie 的瀏覽器到抖音首頁')
    .argument('[cookie-path]', 'Cookie 檔案路徑', getDefaultCookiePath())
    .option('--user-data-dir <path>', '指定用戶數據目錄 (用於保持瀏覽器狀態)')
    .action(async (cookiePath, options) => {
      logger.debug(`Open 命令執行，Cookie 路徑: ${cookiePath}`);
      logger.debug(`CLI 選項: ${JSON.stringify(options)}`);

      // 動態導入 ora 和 chalk
      const [{ default: ora }, { default: chalk }] = await Promise.all([
        import('ora'),
        import('chalk')
      ]);

      const spinner = ora('準備打開瀏覽器...').start();
      let browser: Browser | null = null;

      try {
        // 1. 檢查並載入 Cookie
        spinner.text = '檢查並載入 Cookie...';
        let cookie: string | null = null;
        if (fs.existsSync(cookiePath) && fs.statSync(cookiePath).isFile()) {
            cookie = await loadCookie(cookiePath);
            if (!cookie) {
                spinner.warn(`Cookie 檔案 ${cookiePath} 為空或讀取失敗`);
                // 即使 Cookie 為空，仍然可以打開瀏覽器，只是未登入狀態
            } else {
                 spinner.succeed(`成功載入 Cookie: ${cookiePath}`);
            }
        } else {
            spinner.warn(`Cookie 檔案不存在: ${cookiePath}，將以未登入狀態打開瀏覽器`);
        }

        // 2. 準備瀏覽器選項
        const launchOpts: LaunchOptions = {
          headless: false, // 必須是非無頭模式
          userDataDir: options.userDataDir, // 允許用戶指定數據目錄
          // 可以添加其他需要的選項，例如 executablePath
        };

        // 3. 啟動瀏覽器
        spinner.text = '正在啟動瀏覽器...';
        browser = await launchBrowser(launchOpts);
        spinner.succeed('瀏覽器已啟動');

        // 4. 創建新頁面
        spinner.text = '正在創建頁面...';
        const page = await newPage(browser, { blockResources: false }); // 不阻擋資源，確保頁面完整顯示
        spinner.succeed('頁面已創建');

        // 5. 設定 Cookie (如果已載入)
        if (cookie) {
            spinner.text = '正在設定 Cookie...';
            await setCookiesOnPage(page, cookie, '.douyin.com');
            spinner.succeed('Cookie 已設定');
        }

        // 6. 導航到抖音首頁
        const targetUrl = 'https://www.douyin.com/';
        spinner.text = `正在導航至 ${targetUrl}...`;
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        spinner.succeed(`已導航至 ${targetUrl}`);

        // 7. 提示用戶並等待瀏覽器關閉
        console.log(chalk.green('\n瀏覽器已開啟並載入 Cookie (如果有的話)。'));
        console.log(chalk.yellow('您可以手動操作瀏覽器，完成後請手動關閉瀏覽器視窗。'));
        spinner.stop(); // 停止 spinner

        // 等待瀏覽器斷開連接事件
        await new Promise<void>(resolve => {
            browser?.on('disconnected', () => {
                logger.debug('偵測到瀏覽器已關閉');
                resolve();
            });
        });

        console.log(chalk.blue('瀏覽器已關閉，程式即將退出。'));
        browser = null; // 標記瀏覽器已關閉
        process.exit(0); // Explicitly exit the process

      } catch (error) {
        spinner.fail('執行 open 命令時發生錯誤');
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Open 命令執行失敗:', err);
        console.error(chalk.red(err.message));
        process.exitCode = 1;
      } finally {
        // 雖然等待了 disconnected 事件，但以防萬一再次嘗試關閉
        if (browser && browser.isConnected()) {
            logger.warn('瀏覽器未觸發 disconnected 事件，嘗試強制關閉');
            await closeBrowser(browser);
        }
      }
    });
}