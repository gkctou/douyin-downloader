/**
 * 抖音影片下載範例
 */
import { parseDouyinLinks } from '../src/douyin/parser';
import { fetchVideosInfoUrls } from '../src/douyin/info'; // Remove cleanupBrowser import from here
import { downloadVideo } from '../src/douyin/download';
import { loadCookie } from '../src/douyin/auth';
import path from 'path';
import fs from 'fs-extra';
import { infoLogger, LogLevel } from '../src/utils/logger'; // Updated path to shared utils
import { cleanupBrowser } from '../src/utils/browser'; // Import cleanupBrowser from shared utils
import { Browser, Page } from 'puppeteer'; // Add Puppeteer types
import { launchBrowser, newPage, setCookiesOnPage, closeBrowser } from '../src/douyin/browser/manager'; // Import new browser manager functions

const cookiePath = path.resolve(__dirname, '../douyin.cookie.txt');
// 設置日誌級別
infoLogger.setLevel(LogLevel.DEBUG);

/**
 * 下載單個影片範例
 * @param page Puppeteer Page object, already configured with cookies
 */
async function downloadSingleVideoExample(page: Page) { // Accept page as argument
  try {
    // Removed: Cookie loading is done in main

    // 影片連結
    const videoUrl = 'https://v.douyin.com/fD_JRkZl5_s/';//'https://www.douyin.com/video/7440784860962147611';

    console.log(`[Single] 開始獲取影片 ${videoUrl} 的資訊...`);
    // Pass page instead of cookie
    const videoInfos = await fetchVideosInfoUrls([videoUrl], page);

    if (videoInfos.length === 0) {
      console.error('[Single] 獲取影片資訊失敗');
      return;
    }
    
    const videoInfo = videoInfos[0];
    console.log('[Single] 成功獲取影片資訊:');
    console.log(`  標題: ${videoInfo.title}`);
    console.log(`  作者: ${videoInfo.userName}`);

    // 設定下載路徑
    const downloadDir = path.join(__dirname, 'downloads');
    await fs.ensureDir(downloadDir);
    
    // 生成檔案名稱 (替換不合法字元)
    const sanitizedTitle = videoInfo.title.replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `${sanitizedTitle}.mp4`;
    const outputPath = path.join(downloadDir, fileName);

    console.log(`[Single] 開始下載影片到 ${outputPath}...`);
    await downloadVideo(videoInfo, outputPath, {
      onFileProgress: (progress) => { // Use onFileProgress
        // 顯示下載進度
        console.log(`[Single] 下載進度: ${progress}%`);
      }
    });

    console.log(`[Single] 影片下載完成: ${outputPath}`);
  } catch (error) {
    console.error('[Single] 下載單個影片失敗:', error);
  }
}

/**
 * 從文本中提取連結並下載多個影片
 * @param page Puppeteer Page object, already configured with cookies
 */
async function downloadMultipleVideosExample(page: Page) { // Accept page as argument
  try {
    // Removed: Cookie loading is done in main

    // 包含多個抖音連結的文本
    const text = `
      好看的影片集合：
      https://v.douyin.com/4l6LB9E3Mso/
      https://www.douyin.com/video/7440784860962147611
    `;

    console.log('[Multi] 從文本中解析抖音連結...');
    const parseResults = await parseDouyinLinks(text);

    if (parseResults.length === 0) {
      console.error('[Multi] 未從文本中找到有效的抖音連結');
      return;
    }
    
    console.log(`[Multi] 從文本中解析出 ${parseResults.length} 個連結，開始獲取影片資訊...`);

    // 提取標準化的 URL
    const standardUrls = parseResults.map(result => result.standardUrl);

    // 獲取多個影片的資訊
    // Pass page instead of cookie
    const videoInfos = await fetchVideosInfoUrls(standardUrls, page, {
      onProgress: (current, total) => {
        console.log(`[Multi] 獲取影片資訊進度: ${current}/${total}`);
      }
    });

    console.log(`[Multi] 成功獲取 ${videoInfos.length} 個影片的資訊`);

    // 設定下載目錄
    const downloadDir = path.join(__dirname, 'downloads');
    await fs.ensureDir(downloadDir);
    
    // 逐個下載影片
    console.log('[Multi] 開始下載多個影片...');
    for (const [index, videoInfo] of videoInfos.entries()) {
      // 為每個作者創建子目錄
      const authorDir = path.join(downloadDir, videoInfo.userName.replace(/[\\/:*?"<>|]/g, '_'));
      await fs.ensureDir(authorDir);
      
      // 生成檔案名稱，包含發布日期
      const sanitizedTitle = videoInfo.title.replace(/[\\/:*?"<>|]/g, '_');
      const fileName = `${videoInfo.releaseDate}-${sanitizedTitle}.mp4`;
      const outputPath = path.join(authorDir, fileName);

      console.log(`\n[Multi ${index + 1}/${videoInfos.length}] 下載影片: ${videoInfo.title}`);
      console.log(`  作者: ${videoInfo.userName}`);
      console.log(`  輸出路徑: ${outputPath}`);

      try {
        await downloadVideo(videoInfo, outputPath, {
          onFileProgress: (progress) => { // Use onFileProgress
            // 僅在每 10% 進度時顯示
            if (progress % 10 === 0 && progress > 0) {
              console.log(`[Multi] 下載進度: ${progress}%`);
            }
          }
        });
        console.log(`[Multi] 影片下載完成: ${outputPath}`);
      } catch (downloadError) {
        console.error(`[Multi] 影片 ${videoInfo.title} 下載失敗:`, downloadError);
        // 繼續下載下一個影片
        continue;
      }
    }

    console.log(`\n[Multi] 全部 ${videoInfos.length} 個影片下載完成!`);
  } catch (error) {
    console.error('[Multi] 下載多個影片失敗:', error);
  }
}

/**
 * 帶重試和錯誤處理的下載範例
 * @param page Puppeteer Page object, already configured with cookies
 */
async function downloadWithRetriesExample(page: Page) { // Accept page as argument
  try {
    // Removed: Cookie loading is done in main

    // 影片連結 (可能包含有效和無效的連結)
    const videoUrls = [
      'https://www.douyin.com/video/7440784860962147611',
      'https://www.douyin.com/video/invalid-video-id', // 無效連結
    ];

    // 獲取有效影片的資訊
    console.log('[Retry] 開始獲取影片資訊...');
    // Pass page instead of cookie
    const videoInfos = await fetchVideosInfoUrls(videoUrls, page);

    console.log(`[Retry] 成功獲取 ${videoInfos.length} 個有效影片的資訊`);

    // 設定下載目錄
    const downloadDir = path.join(__dirname, 'downloads');
    await fs.ensureDir(downloadDir);
    
    // 下載影片，設定重試
    for (const videoInfo of videoInfos) {
      const sanitizedTitle = videoInfo.title.replace(/[\\/:*?"<>|]/g, '_');
      const outputPath = path.join(downloadDir, `${sanitizedTitle}.mp4`);

      console.log(`\n[Retry] 開始下載影片: ${videoInfo.title}`);

      // 設定最大重試次數
      const maxRetries = 3;
      let retryCount = 0;
      let success = false;
      
      while (retryCount < maxRetries && !success) {
        try {
          if (retryCount > 0) {
            console.log(`[Retry] 第 ${retryCount} 次重試下載...`);
          }

          await downloadVideo(videoInfo, outputPath, {
            timeout: 30000, // 30秒超時
            onFileProgress: (progress) => { // Use onFileProgress
              if (progress % 20 === 0 && progress > 0) {
                console.log(`[Retry] 下載進度: ${progress}%`);
              }
            }
          });

          success = true;
          console.log(`[Retry] 影片下載成功: ${outputPath}`);
        } catch (downloadError) {
          retryCount++;
          console.error(`[Retry] 下載失敗 (嘗試 ${retryCount}/${maxRetries}):`, downloadError);

          if (retryCount >= maxRetries) {
            console.error(`[Retry] 達到最大重試次數，放棄下載影片: ${videoInfo.title}`);
          } else {
            // 等待後重試
            const waitTime = retryCount * 2000; // 重試間隔遞增
            console.log(`[Retry] 等待 ${waitTime / 1000} 秒後重試...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
    }

    console.log('\n[Retry] 下載操作已完成');
  } catch (error) {
    console.error('[Retry] 下載處理失敗:', error);
  }
}

// 主函數：依次執行各個範例
async function main() {
  let browser: Browser | null = null; // Keep track of the browser instance
  try {
    // Load cookie first
    const cookie = await loadCookie(cookiePath);
    if (!cookie) {
      console.error('未找到有效的 Cookie，請先運行 login-example.ts 進行登入');
      return;
    }

    // Launch browser once
    console.log('啟動瀏覽器...');
    browser = await launchBrowser({ headless: 'new' }); // Or false for visible browser
    const page = await newPage(browser);

    // Set cookies on the page
    console.log('設定 Cookie...');
    // Assuming cookies are for .douyin.com
    await setCookiesOnPage(page, cookie, '.douyin.com');

    console.log('===== 下載單個影片範例 =====');
    await downloadSingleVideoExample(page); // Pass page

    console.log('\n===== 從文本中提取連結並下載多個影片 =====');
    // await downloadMultipleVideosExample(page); // Pass page

    // console.log('\n===== 帶重試和錯誤處理的下載範例 =====');
    // await downloadWithRetriesExample(page); // Pass page

    console.log('\n所有範例執行完畢');
  } catch (error) {
      console.error("執行範例時發生錯誤:", error);
      // Ensure browser is closed even if error occurs after launch
      if (browser) {
          console.log('發生錯誤，清理瀏覽器資源...');
          await closeBrowser(browser);
          browser = null; // Prevent finally block from closing again
      }
  } finally {
    // Use the new closeBrowser function
    if (browser) {
        console.log('清理瀏覽器資源...');
        await closeBrowser(browser);
    }
  }
}

// 如果直接執行此檔案，則運行主函數
if (require.main === module) {
  main(); // No need for extra catch/cleanup here, main handles it
}
