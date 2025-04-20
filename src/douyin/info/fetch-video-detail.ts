/**
 * 影片詳情提取核心功能
 * 從抖音影片頁面獲取詳細資訊 (基於 reference/DouyinParser.ts 邏輯)
 */

import { Page } from 'puppeteer';
import { infoLogger as logger } from '../../utils/logger';
// import { browserManager } from './browser-manager'; // Removed: Page is now passed in
import { VideoInfo } from '../../types';
// import * as fs from 'fs'; // For potential debugging output
// import * as path from 'path'; // For potential debugging output
// import { fileURLToPath } from 'url'; // For potential debugging output

/**
 * 從抖音影片頁面獲取詳細資訊
 * @param videoUrl 標準的抖音影片 URL
 * @param cookie 抖音 Cookie 字串
 * @returns Promise<VideoInfo | null> 影片資訊或 null
 */
export async function fetchVideoDetail(
  page: Page, // Changed: Accept Page object
  videoUrl: string
  // cookie: string // Removed: Cookie should be set on the page beforehand
): Promise<VideoInfo | null> {
  // let page: Page | null = null; // Removed: Page is passed in

  try {
    logger.debug(`[fetchVideoDetail] 使用傳入的 Page 獲取影片資訊: ${videoUrl}`);

    // Removed: Page creation and setup (User-Agent, Cookie) are now handled by the caller

    // --- 導航到頁面 ---
    logger.debug(`[fetchVideoDetail] 正在導航至 ${videoUrl}...`);
    await page.goto(videoUrl, {
      waitUntil: 'networkidle2', // 等待網路大致空閒
      timeout: page.getDefaultTimeout() || 60000 // 使用頁面預設超時或 60s
    });
    logger.debug('[fetchVideoDetail] 頁面導航完成');

    // --- 等待關鍵元素出現 ---
    const videoSelector = 'video'; // 主要等待目標
    const waitTimeout = 20000; // 增加等待時間
    try {
      logger.debug(`[fetchVideoDetail] 正在等待影片選擇器: ${videoSelector} (最多 ${waitTimeout}ms)...`);
      await page.waitForSelector(videoSelector, { timeout: waitTimeout });
      logger.debug('[fetchVideoDetail] 影片選擇器已找到！');
      // 將影片元素的 src 屬性字首 'blob:' 移除，以強制重新加載
      await page.evaluate(() => {
        const videoElement = document.querySelector('video[src]');
        if (videoElement) {
          const src = videoElement.getAttribute('src');
          if (src && src.startsWith('blob:')) {
            videoElement.setAttribute('src', src.replace('blob:', ''));
            console.log('已移除 blob: 前綴');
          }
        }
      });
      await page.waitForSelector('video source[src]', { timeout: waitTimeout });
    } catch (waitError) {
      const error = waitError instanceof Error ? waitError : new Error(String(waitError));
      logger.error(`[fetchVideoDetail] 等待元素 (${videoSelector}) 時超時或出錯: ${error.message}`);
      logger.warn('[fetchVideoDetail] 頁面可能未完全加載或結構已更改。');
      // --- 可選：保存 HTML 以便調試 ---
      // try {
      //   const pageContent = await page.content();
      //   // 需要找到替代 import.meta.url 的方法來確定路徑，或使用固定路徑
      //   // const debugHtmlPath = path.join(__dirname, '../../../', 'debug_page_wait_error.html');
      //   // fs.writeFileSync(debugHtmlPath, pageContent);
      //   // logger.info(`頁面 HTML 已保存到 ${debugHtmlPath} 以便調試。`);
      // } catch (writeError) {
      //   const err = writeError instanceof Error ? writeError : new Error(String(writeError));
      //   logger.error('保存 debug HTML 時出錯:', err.message);
      // }
      // --- 結束可選調試 ---
      return null; // 等待失敗，無法繼續提取
    }

    // --- 直接從 HTML 元素提取資訊 ---
    logger.debug('[fetchVideoDetail] 等待完成，正在嘗試直接從 HTML 元素提取資訊...');
    const extractedDetails = await page.evaluate(() => {
      // --- 提取邏輯 (合併自 reference 和 extractors) ---

      // 提取 ID (參考 extractVideoId)
      let id = '';
      const urlMatch = window.location.href.match(/\/video\/(\d+)/);
      if (urlMatch && urlMatch[1]) {
        id = urlMatch[1];
      } else {
        const canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink) {
          const href = canonicalLink.getAttribute('href') || '';
          const canonicalMatch = href.match(/\/video\/(\d+)/);
          if (canonicalMatch && canonicalMatch[1]) {
            id = canonicalMatch[1];
          }
        }
      }
      if (!id) {
        const metaUrl = document.querySelector('meta[property="og:url"]');
        if (metaUrl) {
          const content = metaUrl.getAttribute('content') || '';
          const metaMatch = content.match(/\/video\/(\d+)/);
          if (metaMatch && metaMatch[1]) {
            id = metaMatch[1];
          }
        }
      }
      // 可以在此處添加從頁面源碼提取 ID 的備用邏輯，但 evaluate 中訪問 innerHTML 可能有限制

      // 提取標題 (參考 reference 和 extractTitle)
      let title = '';
      // 1. 嘗試使用 reference 中的特定 H1 選擇器
      const specificH1Selector = 'h1 > span > span:nth-child(2) > span > span:first-child > span:first-child > span:first-child > span:first-child';
      const specificH1Element = document.querySelector(specificH1Selector);
      if (specificH1Element) {
        title = specificH1Element.textContent?.trim() || '';
      }

      // 2. 如果特定 H1 失敗，回退到 document.title
      if (!title) {
        title = document.title || '';
      }

      // 3. 如果 document.title 也失敗，嘗試 og:title
      if (!title) {
        const metaTitle = document.querySelector('meta[property="og:title"]');
        if (metaTitle) {
          title = metaTitle.getAttribute('content') || '';
        }
      }
      // 最終如果還是空，會在返回時處理為 '未知標題'
      title = (title||'').split('#')[0].trim(); // 去除 # 及其後的內容
      // 提取影片播放連結 (參考 reference 和 extractVideoUrl)
      let videoPlayUrl = '';
      let cdnPlayUrls: string[] = [];
      const videoSourceSelector = 'video source[src]';
      const sourceElements = document.querySelectorAll(videoSourceSelector);
      let videoUrls = Array.from(sourceElements).map(v => v.getAttribute('src') || '');
      videoPlayUrl = videoUrls.pop() || '';
      cdnPlayUrls = videoUrls;
      // 可以在此處添加從 script 提取的備用邏輯

      // 提取作者資訊 (參考 reference 和 extractAuthorInfo)
      let userName = '';
      let userUrl = '';
      const userJsonSelector = 'script[type="application/ld+json"]';
      const userJsonElement = document.querySelector(userJsonSelector);
      if (userJsonElement) {
        try {
          const userJsonText = userJsonElement.textContent?.trim() || '{}';
          const userJson = JSON.parse(userJsonText);
          // reference 中的邏輯是取 itemListElement[1] 或 itemListElement[length - 2]
          if (userJson.itemListElement && userJson.itemListElement.length > 1) {
            // 假設作者信息在倒數第二個元素
            const userItem = userJson.itemListElement[userJson.itemListElement.length - 2];
            if (userItem && userItem.name && userItem.item) {
              userName = userItem.name;
              userUrl = userItem.item;
            } else if (userJson.itemListElement.length > 1) { // 備用：取第二個
              const backupUserItem = userJson.itemListElement[1];
              if (backupUserItem && backupUserItem.name && backupUserItem.item) {
                userName = backupUserItem.name;
                userUrl = backupUserItem.item;
              }
            }
          }
        } catch (e) { console.error('解析用戶 JSON-LD 失敗:', e); }
      }
      // 可以在此處添加從其他元素提取作者的備用邏輯

      // 提取發布日期 (參考 reference 和 extractReleaseDate)
      let releaseDate = '';
      const metaDescriptionSelector = 'meta[name="description"]';
      const metaDescriptionElement = document.querySelector(metaDescriptionSelector);
      if (metaDescriptionElement) {
        const content = metaDescriptionElement.getAttribute('content') || '';
        const dateMatch = content.match(/于(\d{8}|\d{4}-\d{2}-\d{2})发布/); // 匹配 YYYYMMDD 或 YYYY-MM-DD
        if (dateMatch && dateMatch[1]) {
          const rawDate = dateMatch[1];
          if (rawDate.includes('-')) {
            releaseDate = rawDate;
          } else if (rawDate.length === 8) {
            releaseDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
          }
        }
      }
      // 可以在此處添加從 time 元素或其他元素提取日期的備用邏輯

      // 提取封面 URL (參考 extractCoverUrl)
      let coverUrl = '';
      const metaOgImage = document.querySelector('meta[property="og:image"]');
      if (metaOgImage) {
        coverUrl = metaOgImage.getAttribute('content') || '';
      } else {
        const videoPoster = document.querySelector('video[poster]');
        if (videoPoster) {
          coverUrl = videoPoster.getAttribute('poster') || '';
        }
      }
      // 可以在此處添加從 JSON-LD 或頁面源碼提取封面的備用邏輯

      return {
        id: id || '',
        title: title || '未知標題',
        videoPlayUrl: videoPlayUrl || '',
        cdnPlayUrls: cdnPlayUrls || [],
        userName: userName || '未知用戶',
        userUrl: userUrl || '',
        releaseDate: releaseDate || '',
        coverUrl: coverUrl || '',
      };
    });

    // 檢查是否成功提取到必要資訊 (播放連結)
    if (!extractedDetails || !extractedDetails.videoPlayUrl) {
      logger.error(`[fetchVideoDetail] 未能從 HTML 元素中提取到必要的影片 ID 或播放連結: ${videoUrl}`);
      logger.debug('[fetchVideoDetail] 提取到的部分資訊:', extractedDetails);
      // --- 可選：保存 HTML 以便調試 ---
      // try {
      //   const pageContent = await page.content();
      //   // 需要找到替代 import.meta.url 的方法來確定路徑，或使用固定路徑
      //   // const debugHtmlPath = path.join(__dirname, '../../../', 'debug_page_extract_error.html');
      //   // fs.writeFileSync(debugHtmlPath, pageContent);
      //   // logger.info(`頁面 HTML 已保存到 ${debugHtmlPath} 以便調試。`);
      // } catch (writeError) {
      //   const err = writeError instanceof Error ? writeError : new Error(String(writeError));
      //   logger.error('保存 debug HTML 時出錯:', err.message);
      // }
      // --- 結束可選調試 ---
      return null;
    }

    logger.debug('[fetchVideoDetail] 成功從 HTML 元素提取到影片資訊！');

    // 構建 VideoInfo 物件
    const videoInfo: VideoInfo = {
      id: extractedDetails.id,
      title: extractedDetails.title,
      videoPlayUrl: extractedDetails.videoPlayUrl,
      cdnPlayUrls: extractedDetails.cdnPlayUrls,
      userName: extractedDetails.userName,
      userUrl: extractedDetails.userUrl,
      releaseDate: extractedDetails.releaseDate || undefined, // 如果為空字符串，設為 undefined
      coverUrl: extractedDetails.coverUrl || undefined, // 如果為空字符串，設為 undefined
    };

    logger.info(`[fetchVideoDetail] 成功獲取影片資訊: ${videoInfo.title}`);
    return videoInfo;

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[fetchVideoDetail] 獲取影片資訊失敗: ${videoUrl}`, err);
    // 可以在此處添加更詳細的錯誤堆棧打印
    // logger.error(err.stack);
    return null;
  }
  // Removed: finally block - page lifecycle is managed by the caller
}