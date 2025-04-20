/**
 * 影片命令
 * 提供 'dydl video' 命令的實現
 */

import fs from 'fs-extra';
import path from 'path';
import { Command } from 'commander';
// 使用 dynamic import 代替直接導入 ESM 模塊
// import ora from 'ora';
// import chalk from 'chalk';
import { downloadVideosFromText } from '../../douyin/download'; // Corrected path
import { checkAndGetCookie } from '../utils';
import { cliLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { createDownloadProgressHandler } from '../progress-display';
// import { cleanupBrowser } from '../../utils/browser'; // Removed old cleanup
import { Browser, Page } from 'puppeteer'; // Add Puppeteer types
import { launchBrowser, newPage, setCookiesOnPage, closeBrowser } from '../../douyin/browser/manager'; // Import new browser manager functions

/**
 * 註冊影片命令
 * @param program Commander 實例
 */
export function registerVideoCommand(program: Command): void {
  program
    .command('video')
    .description('下載抖音影片')
    .argument('<sources...>', '影片連結或包含連結的文本')
    .option('-c, --cookie <path>', '指定包含有效 Cookie 的檔案路徑')
    .option('-d, --directory <path>', '指定輸出目錄', process.cwd()) // Changed -o to -d
    .option('-f, --file <path>', '指定單一影片的輸出檔案路徑') // Added -f
    .option('--concurrency <num>', '並行下載的數量', '3')
    .option('--retries <num>', '下載失敗時的重試次數', '3')
    .option('--no-subfolders', '不使用子資料夾儲存檔案')
    .option('--filename-template <template>', '檔名模板，如 "{date}-{title}"', '{date}-{title}')
    .option('--overwrite', '覆蓋已存在的檔案')
    .option('--user-data-dir <path>', '指定 Puppeteer 使用者資料目錄')
    .action(async (sources, options) => {
      logger.debug('影片命令執行，選項:', options);
      
      // 動態導入 ESM 模塊
      const [{ default: ora }, { default: chalk }] = await Promise.all([
        import('ora'),
        import('chalk')
      ]);
      
      const spinner = ora('準備下載...').start();
      let browser: Browser | null = null; // Keep track of browser instance

      try {
        // 解析選項
        const cookiePath = options.cookie;
        const outputDirectory = options.directory; // Changed from output
        const outputFile = options.file; // Added file option
        const concurrency = parseInt(options.concurrency, 10);
        const retries = parseInt(options.retries, 10);
        const useSubfolders = options.subfolders !== false;
        const filenameTemplate = options.filenameTemplate;
        const overwrite = options.overwrite || false;
        const userDataDir = options.userDataDir;

        // --- 選項驗證 ---
        if (outputFile && outputDirectory !== process.cwd()) { // Check if both -f and -d (non-default) are provided
            spinner.fail(`錯誤：不能同時指定輸出檔案 (-f) 和輸出目錄 (-d)`);
            console.log(chalk.yellow('請只選擇其中一個選項。'));
            return;
        }
        if (outputFile && sources.length > 1) {
            spinner.fail(`錯誤：當指定輸出檔案 (-f) 時，只能提供一個影片來源`);
            console.log(chalk.yellow(`您提供了 ${sources.length} 個來源。請移除 -f 選項或只提供一個來源。`));
            return;
        }
        // ---

        // 檢查 Cookie
        spinner.text = '檢查 Cookie...';
        const cookie = await checkAndGetCookie(cookiePath);
        if (!cookie) {
          spinner.fail('缺少有效的 Cookie，無法下載影片');
          console.log(chalk.yellow(`請執行 ${chalk.cyan('dydl login')} 登入抖音並取得 Cookie`));
          return;
        }

        // 準備輸出路徑
        spinner.text = '準備輸出路徑...';
        let finalOutputPath: string;

        try {
            if (outputFile) {
                // 使用 -f 指定檔案路徑
                finalOutputPath = path.resolve(outputFile); // 解析為絕對路徑
                const parentDir = path.dirname(finalOutputPath);
                await fs.ensureDir(parentDir); // 確保父目錄存在
                logger.debug(`輸出檔案路徑設定為: ${finalOutputPath}`);
            } else {
                // 使用 -d 指定目錄路徑 (或預設)
                finalOutputPath = path.resolve(outputDirectory); // 解析為絕對路徑
                await fs.ensureDir(finalOutputPath); // 確保目錄存在
                logger.debug(`輸出目錄路徑設定為: ${finalOutputPath}`);
            }
        } catch (error) {
            spinner.fail(`準備輸出路徑失敗: ${(error instanceof Error ? error.message : String(error))}`);
            return;
        }

        // 組合所有輸入文本
        spinner.text = '解析抖音連結...';
        const combinedText = sources.join(' ');

        // --- Browser Management ---
        spinner.text = '啟動瀏覽器...';
        browser = await launchBrowser({
          headless: 'new', // Or false
          userDataDir: userDataDir // 傳遞 userDataDir
        });
        const page = await newPage(browser);
        spinner.text = '設定 Cookie...';
        await setCookiesOnPage(page, cookie, '.douyin.com'); // Assuming .douyin.com
        // --- End Browser Management ---

        // 創建下載進度處理器
        const progressHandler = await createDownloadProgressHandler(spinner);

        // 下載選項
        const downloadOptions = {
          concurrency,
          retries,
          onProgress: progressHandler,
          useSubfolders,
          filenameTemplate,
          overwrite
        };
        
        // 下載影片
        // Pass page instead of cookie
        const downloadedFiles = await downloadVideosFromText(
          combinedText,
          finalOutputPath,
          page,
          downloadOptions
        );

        if (downloadedFiles.length > 0) {
          spinner.succeed(`成功下載 ${downloadedFiles.length} 個影片`);
          
          // 顯示下載的檔案
          console.log(chalk.green('\n下載的檔案:'));
          downloadedFiles.forEach((file: string, index: number) => {
            console.log(`${index + 1}. ${chalk.cyan(file)}`);
          });
        } else {
          spinner.fail('未下載任何影片');
          
          // 提供可能的原因
          if (combinedText.includes('douyin.com') || combinedText.includes('抖音')) {
            console.log(chalk.yellow('可能的原因:'));
            console.log(chalk.yellow('1. 影片連結無效或已失效'));
            console.log(chalk.yellow('2. Cookie 有效但權限不足'));
            console.log(chalk.yellow('3. 影片已被刪除或設為私人'));
            console.log(chalk.yellow('4. 網絡問題導致無法獲取影片資訊'));
          } else {
            console.log(chalk.yellow('輸入中未找到有效的抖音影片連結'));
          }
        }
      } catch (error) {
        spinner.fail('下載過程中發生錯誤');
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('影片命令執行失敗:', err);
        console.error(chalk.red(err.message));
        
        // 提供錯誤處理建議
        console.log(chalk.yellow('\n如何解決:'));
        console.log('1. 檢查網絡連接');
        console.log('2. 確認影片連結是否有效');
        console.log('3. 嘗試重新登入以更新 Cookie');
        console.log(`4. 使用 ${chalk.cyan('--retries')} 選項增加重試次數`);
        
        process.exitCode = 1;
      } finally {
        // Use the new closeBrowser function
        if (browser) {
            spinner.stop(); // Stop spinner before logging cleanup
            console.log('\n清理瀏覽器資源...');
            await closeBrowser(browser);
            logger.debug('已清理瀏覽器資源');
        }
        // Let the process exit naturally based on exitCode
      }
    });
}