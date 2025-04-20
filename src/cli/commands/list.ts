/**
 * 列表命令
 * 提供 'dydl list' 命令的實現，用於獲取用戶影片列表
 */

import fs from 'fs-extra';
import path from 'path';
import { Command } from 'commander';
import { checkAndGetCookie } from '../utils';
// Import rootLogger and LogLevel - Keep for potential future use if needed
import { rootLogger, LogLevel } from '../../utils/logger';
import { fetchUserVideos } from '../../douyin/info/user'; // Correct path
import { UserVideoItem } from '../../types';

/**
 * 註冊列表命令
 * @param program Commander 實例
 */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('獲取指定抖音使用者發布的影片列表')
    .argument('<user_profile_url>', '使用者的個人頁面連結 (僅支援單個)')
    .option('-c, --cookie <path>', '指定包含有效 Cookie 的檔案路徑')
    .option('--user-data-dir <path>', '指定 Puppeteer 使用者資料目錄 (主要用於 Cookie 相關操作)')
    .option('-f, --file <path>', '將結果輸出為 JSON 檔案的路徑')
    .option('-n, --count <number>', '指定獲取影片的數量 (預設獲取全部)', '0') // Default to '0' for all
    .action(async (userProfileUrl, options) => {
      // --- 輸入驗證 ---
      // Commander's .argument('<arg>') handles the presence of the argument.
      // We need to ensure only one URL is conceptually passed, although commander collects extras in program.args
      // A simple check on the input argument itself is sufficient here as we define only one.
      // If multiple URLs were intended, we'd use '<urls...>' and check options.args length.

      const outputFile = options.file;
      const cookiePath = options.cookie;
      const userDataDir = options.userDataDir; // Keep for consistency, might be used by cookie logic
      const count = parseInt(options.count, 10);

      if (isNaN(count) || count < 0) {
          console.error('錯誤：--count 參數必須是一個非負整數。');
          process.exitCode = 1;
          return;
      }

      // --- 輸出控制 ---
      const isSilent = !outputFile; // Determine if silent mode is needed
      // Silent logic for logger is now handled in logger constructor

      try {
        // 1. 檢查 Cookie, pass silent flag
        const cookie = await checkAndGetCookie(cookiePath, isSilent); // Pass isSilent // userDataDir might be implicitly used here if cookiePath is null
        if (!cookie) {
          // Error message is handled inside checkAndGetCookie (if not silent)
          // or just exits silently if silent. We still need to set exit code.
          process.exitCode = 1; // Ensure exit code is set even if silent
          return;
        }

        // 2. 獲取用戶影片列表
        // Pass an empty options object to fetchUserVideos to avoid triggering onProgress
        const userVideos: UserVideoItem[] = await fetchUserVideos(userProfileUrl, cookie, count, {});

        // 3. 輸出結果
        if (outputFile) {
          // 輸出到檔案
          try {
            const outputDir = path.dirname(outputFile);
            await fs.ensureDir(outputDir);
            await fs.writeJson(outputFile, userVideos, { spaces: 2 });
            // No console output on success
          } catch (error) {
             console.error(`錯誤：無法寫入 JSON 檔案 ${outputFile}:`, error);
             process.exitCode = 1;
          }
        } else {
          // 輸出到控制台
          process.stdout.write(JSON.stringify(userVideos, null, 2) + '\n');
        }

      } catch (error) {
        // Handle errors from checkAndGetCookie or fetchUserVideos
        console.error('獲取用戶影片列表過程中發生錯誤:', error);
        process.exitCode = 1;
      }
      // Console restore logic moved to bin/dydl.ts
    });
}