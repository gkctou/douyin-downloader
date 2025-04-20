/**
 * 資訊命令
 * 提供 'dydl info' 命令的實現
 */

import fs from 'fs-extra';
import path from 'path';
import { Command } from 'commander';
import { checkAndGetCookie } from '../utils';
// Import rootLogger and LogLevel
import { rootLogger, LogLevel } from '../../utils/logger';
import { Browser } from 'puppeteer';
import { launchBrowser, newPage, setCookiesOnPage, closeBrowser } from '../../douyin/browser/manager';
import { parseDouyinLinks } from '../../douyin/parser';
import { fetchVideosInfoUrls } from '../../douyin/info';
import { VideoInfo } from '../../types';

/**
 * 註冊資訊命令
 * @param program Commander 實例
 */
export function registerInfoCommand(program: Command): void {
  program
    .command('info')
    .description('獲取抖音影片的詳細資訊')
    .argument('<sources...>', '影片連結或包含連結的文本')
    .option('-c, --cookie <path>', '指定包含有效 Cookie 的檔案路徑')
    .option('--user-data-dir <path>', '指定 Puppeteer 使用者資料目錄')
    .option('-f, --file <path>', '將結果輸出為 JSON 檔案的路徑')
    .action(async (sources, options) => {
      const outputFile = options.file;
      const cookiePath = options.cookie;
      const userDataDir = options.userDataDir;

      // --- 輸出控制 ---
      const isSilent = !outputFile; // Determine if silent mode is needed
      // Silent logic for logger is now handled in logger constructor

      let browser: Browser | null = null;

      try {
        // 1. 檢查 Cookie
        // checkAndGetCookie will respect silent mode if console is overridden at entry point
        const cookie = await checkAndGetCookie(cookiePath, isSilent); // Pass isSilent
        if (!cookie) {
          // Error message is handled inside checkAndGetCookie (if not silent)
          // or just exits silently if silent. We still need to set exit code.
          // Use console.error directly as it's not overridden
          console.error('錯誤：缺少有效的 Cookie，無法獲取資訊。');
          console.error(`請執行 'dydl login' 登入抖音並取得 Cookie`);
          process.exitCode = 1;
          return;
        }

        // 2. 啟動瀏覽器
        browser = await launchBrowser({ headless: 'new', userDataDir });
        const page = await newPage(browser);
        await setCookiesOnPage(page, cookie, '.douyin.com');

        // 3. 解析連結
        const combinedText = sources.join(' ');
        const parseResults = await parseDouyinLinks(combinedText, { concurrency: 3 }); // Use default concurrency for now
        if (parseResults.length === 0) {
           console.error('錯誤：未在輸入中找到有效的抖音影片連結。');
           process.exitCode = 1;
           return; // Exit early
        }
        const videoUrls = parseResults.map(r => r.standardUrl);

        // 4. 獲取影片資訊
        const videoInfos: VideoInfo[] = await fetchVideosInfoUrls(videoUrls, page, { concurrency: 3 }); // Use default concurrency

        if (videoInfos.length === 0) {
            console.error('錯誤：無法獲取任何影片的詳細資訊。');
            process.exitCode = 1;
            return;
        }

        // 5. 準備結果 (單個物件或陣列)
        const result = videoInfos.length === 1 ? videoInfos[0] : videoInfos;

        // 6. 輸出結果
        if (outputFile) {
          // 輸出到檔案
          try {
            const outputDir = path.dirname(outputFile);
            await fs.ensureDir(outputDir);
            await fs.writeJson(outputFile, result, { spaces: 2 });
             // No console output if writing to file successfully
          } catch (error) {
             // Always output critical errors to stderr
             console.error(`錯誤：無法寫入 JSON 檔案 ${outputFile}:`, error);
             process.exitCode = 1;
          }
        } else {
          // 輸出到控制台
          // Ensure only this JSON is printed
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        }

      } catch (error) {
        // Always output critical errors to stderr
        console.error('獲取影片資訊過程中發生錯誤:', error);
        process.exitCode = 1;
      } finally {
        if (browser) {
          await closeBrowser(browser);
        }
        // Console restore logic moved to bin/dydl.ts
      }
    });
}