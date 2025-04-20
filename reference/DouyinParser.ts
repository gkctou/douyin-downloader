import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Browser } from 'puppeteer'; // 引入 puppeteer
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteer from 'puppeteer-extra';

// Apply the stealth plugin
puppeteer.use(StealthPlugin());

// DouyinParser.ts

/**
 * 解析抖音短連結並取得最終的標準影片 URL。
 * @param shortUrl 抖音短連結
 * @returns 標準的抖音影片 URL (e.g., https://www.douyin.com/video/...), 或在無法解析/提取 ID 時返回 null
 */
async function parseDouyinShortUrl(shortUrl: string): Promise<string | null> {
  console.log(`正在解析抖音短連結: ${shortUrl}`);
  try {
    // 使用 fetch 發送請求，設定 redirect: 'follow' 來自動跟隨重定向
    const response = await fetch(shortUrl, {
      method: 'GET',
      redirect: 'follow', // 讓 fetch 自動處理重定向
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error(`無法解析短連結 ${shortUrl}，狀態碼: ${response.status}`);
      return null;
    }

    const finalUrl = response.url;
    console.log(`解析後的最終 URL: ${finalUrl}`);

    // 優先檢查路徑是否為標準影片格式
    if (finalUrl && finalUrl.includes('douyin.com/video/')) {
      const videoIdMatch = finalUrl.match(/video\/(\d+)/);
      if (videoIdMatch && videoIdMatch[1]) {
        const standardUrl = `https://www.douyin.com/video/${videoIdMatch[1]}`;
        console.log(`解析成功 (路徑匹配)！標準 URL: ${standardUrl}`);
        return standardUrl;
      }
    }

    // 如果路徑不匹配，嘗試從查詢參數提取 vid
    try {
      const urlObject = new URL(finalUrl);
      const videoId = urlObject.searchParams.get('vid');
      if (videoId) {
        const standardUrl = `https://www.douyin.com/video/${videoId}`;
        console.log(`解析成功 (vid 參數匹配)！標準 URL: ${standardUrl}`);
        return standardUrl;
      }
    } catch (e) {
      // URL 解析失敗，忽略
      console.warn(`解析最終 URL (${finalUrl}) 以提取 vid 時出錯:`, (e as Error).message);
    }

    // 如果兩種方法都失敗
    console.error(`無法從最終 URL (${finalUrl}) 提取有效的影片 ID。`);
    return null; // 返回 null 表示無法獲取標準影片 URL

  } catch (error) {
    const parseError = error as Error;
    console.error(`解析短連結 ${shortUrl} 時發生錯誤:`, parseError.message);
    return null;
  }
}

// 返回類型不變
interface VideoDetails {
  title: string;
  videoPlayUrl: string;
  userName: string;
  userUrl: string;
  releaseDate: string;
}

/**
 * 從抖音影片頁面 URL 爬取影片詳細資訊 (使用 Puppeteer)。
 * @param videoUrl **標準的** 抖音影片 URL
 * @returns 包含影片標題和播放連結的物件，或在失敗時返回 null
 */
async function fetchVideoDetails(videoUrl: string): Promise<VideoDetails | null> {
  // ... (fetchVideoDetails 函數內部邏輯保持不變) ...
  console.log(`\n正在嘗試使用 Puppeteer 從 ${videoUrl} 爬取影片詳細資訊...`);
  let browser: Browser | null = null; // 將 browser 宣告在 try 外部，以便在 finally 中關閉

  try {
    // --- 讀取 Cookie ---
    let cookieString = '';
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const cookiePath = path.join(__dirname, '../douyin.cookie.txt');
    try {
      cookieString = fs.readFileSync(cookiePath, 'utf-8').trim();
      console.log('成功讀取 cookie.txt');
    } catch (err) {
      const error = err as Error;
      console.warn(`讀取 cookie.txt 失敗 (路徑: ${cookiePath}): ${error.message}。將不使用 Cookie 進行請求。`);
    }

    // --- 啟動 Puppeteer ---
    console.log('正在啟動 Puppeteer...');
    browser = await puppeteer.launch({
      headless: false, // 保持無頭模式，但將控制台輸出管道化
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // 常用於 Docker 或 CI 環境
    });

    const page = (await browser.pages())[0];// || await browser.newPage();

    // --- 將瀏覽器控制台消息轉發到 Node 控制台 ---
    page.on('console', msg => {
      const type = msg.type().toUpperCase().padEnd(5); // LOG, WARN, ERR etc.
      const text = msg.text();
      // 避免打印空消息或過於冗餘的消息
      if (!text || text.includes('JSHandle@')) return;

      let color = '\x1b[0m'; // Default (reset)
      if (type.startsWith('ERR')) color = '\x1b[31m'; // Red
      else if (type.startsWith('WARN')) color = '\x1b[33m'; // Yellow
      else if (type.startsWith('INFO')) color = '\x1b[34m'; // Blue
      else if (type.startsWith('DEBUG')) color = '\x1b[35m'; // Magenta
      else color = '\x1b[37m'; // White for LOG

      console.log(`\x1b[36m[Browser ${type}]\x1b[0m ${color}${text}\x1b[0m`); // Cyan prefix
    });
    // --- 瀏覽器控制台轉發設定結束 ---

    console.log('Puppeteer 頁面已開啟');

    // --- 設定 User Agent 和 Cookie ---
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    // page.setCookie()
    if (cookieString) {
      const cookies = cookieString.split(';').map(pair => {
        const parts = pair.trim().split('=');
        if (parts.length >= 2) {
          return { name: parts[0], value: parts.slice(1).join('='), domain: '.douyin.com' };
        }
        return null;
      }).filter(cookie => cookie !== null) as any[];
      if (cookies.length > 0) {
        await page.setCookie(...cookies);
        console.log('已設定 Cookie');
      } else {
        console.log('Cookie 字串解析後為空或無效，未設定 Cookie');
      }
    }

    // --- 導航到頁面 ---
    console.log(`正在導航至 ${videoUrl}...`);
    await page.goto(videoUrl, {
      // waitUntil: 'networkidle2', // 仍然等待網路大致空閒
      // timeout: 60000
    });
    console.log('頁面導航完成');

    try {
      // --- 等待關鍵元素出現 ---
      const videoReadySelector = 'video[src]'; // 等待影片元素video[src],
      const waitReadyTimeout = 15000; // 等待 15 秒
      console.log(`正在等待影片準備選擇器: ${videoReadySelector} (最多 ${waitReadyTimeout}ms)...`);
      await page.waitForSelector(videoReadySelector, { timeout: waitReadyTimeout });
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
      console.log('影片準備選擇器已找到！');

      const videoSelector = 'video source[src]'; // 等待影片元素video[src], 
      const waitTimeout = 15000; // 等待 15 秒

      console.log(`正在等待影片選擇器: ${videoSelector} (最多 ${waitTimeout}ms)...`);
      await page.waitForSelector(videoSelector, { timeout: waitTimeout });
      console.log('影片選擇器已找到！');

    } catch (waitError) {
      const error = waitError as Error;
      console.error(`等待元素時超時或出錯: ${error.message}`);
      console.error('頁面可能未完全加載或結構已更改。');
      // --- ADDED: Save HTML for debugging ---
      try {
        const pageContent = await page.content();
        const debugHtmlPath = path.join(__dirname, 'debug_page_wait_error.html'); // Use a different name
        fs.writeFileSync(debugHtmlPath, pageContent);
        console.log(`頁面 HTML 已保存到 ${debugHtmlPath} 以便調試。`);
      } catch (writeError) {
        const err = writeError as Error;
        console.error('保存 debug_page_wait_error.html 時出錯:', err.message);
      }
      // --- END ADDED ---
      return null; // 等待失敗，無法繼續提取
    }


    // --- 直接從 HTML 元素提取資訊 ---
    console.log('等待完成，正在嘗試直接從 HTML 元素提取資訊...');
    const extractedDetails = await page.evaluate(() => {
      console.log('--- Browser Evaluate Start ---');

      let releaseDate = '';
      //<meta name="description" content="这期还是Ai给写的文案，猜猜像谁的风格？#自然流ip孵化 #瑶瑶Ai智能体 - 瑶瑶（IP智能体）于20241124发布在抖音，已经收获了127.6万个喜欢，来抖音，记录美好生活！" data-rh="true">
      // 提取影片發布日期
      const metaDescriptionSelector = 'meta[name="description"]';
      const metaDescriptionElement = document.querySelector(metaDescriptionSelector);
      console.log(`Meta Description Element (${metaDescriptionSelector}):`, metaDescriptionElement ? 'Found' : 'Not Found');

      if (metaDescriptionElement) {
        const content = metaDescriptionElement.getAttribute('content') || '';
        console.log('Meta Description Content:', content);

        // 使用正則表達式提取日期 (格式為 8 位數字，例如 20241124)
        // const dateMatch = content.match(/(\d{8})/);
        // 使用正則表達式提取「于...发布」中的日期
        const dateMatch = content.match(/于(\d+)发布/);
        releaseDate = dateMatch ? dateMatch[1] : '';
        console.log('Extracted Release Date:', releaseDate);

        // 如果需要格式化日期 (例如 2024-11-24)
        if (releaseDate) {
          releaseDate = `${releaseDate.slice(0, 4)}-${releaseDate.slice(4, 6)}-${releaseDate.slice(6, 8)}`;
          console.log('Formatted Release Date:', releaseDate);
        }
      }

      // 提取影片標題 (主要依賴備用方案)
      let title = '未知標題';
      const h1TitleSelector = 'h1 > span > span:nth-child(2) > span > span:first-child > span:first-child > span:first-child > span:first-child'
      const h1TitleElement = document.querySelector(h1TitleSelector);
      console.log(`H1 Title Element (${h1TitleSelector}):`, h1TitleElement ? 'Found' : 'Not Found');
      title = h1TitleElement ? h1TitleElement.textContent?.trim() || document.title : document.title;
      console.log('Extracted Title:', title);
      // <script type="application/ld+json" nonce="" data-rh="true">
      // {
      //   "@context": "https://schema.org",
      //   "@type": "BreadcrumbList",
      //   "itemListElement": [
      //     {
      //       "@type": "ListItem",
      //       "position": 1,
      //       "name": "抖音",
      //       "item": "https://www.douyin.com"
      //     },
      //     {
      //       "@type": "ListItem",
      //       "position": 2,
      //       "name": "瑶瑶（IP智能体）",
      //       "item": "https://www.douyin.com/user/MS4wLjABAAAAB4OQjRzVeQs-4QgXP_g9f6U31Nsq1JvhCEJ9622OcfQJEwI_oVb2m3B9w-uAvRm0"
      //     },
      //     {
      //       "@type": "ListItem",
      //       "position": 3,
      //       "name": "视频作品",
      //       "item": "https://www.douyin.com/video/7440784860962147611"
      //     }
      //   ]
      // }
      // </script>
      let userName = '';
      let userUrl = '';
      const userJsonSelector = 'script[type="application/ld+json"]';
      const userJsonElement = document.querySelector(userJsonSelector);
      console.log(`H1 Title Element (${userJsonSelector}):`, userJsonElement ? 'Found' : 'Not Found');
      if (userJsonElement) {
        const userJsonText = userJsonElement.textContent?.trim() || '';
        const userJson = JSON.parse(userJsonText);
        const userList = userJson.itemListElement;
        if (userList && userList.length > 0) {
          const userItem = userList[userList.length - 1 - 1];
          userName = userItem.name;
          userUrl = userItem.item;
          console.log('Extracted User Name:', userName);
          console.log('Extracted User URL:', userUrl);
        } else {
          console.log('無法提取用戶名稱和用戶 URL，itemListElement 為空或無效');
        }
      } else {
        console.log('無法提取用戶名稱和用戶 URL，未找到 JSON-LD 元素');
      }
      // const userJsonElement = document.querySelector(userJsonSelector);
      // let userJson = userJsonElement && userJsonElement.textContent?.trim() || '';
      console.log('Extracted Title:', title);
      //const v= document.querySelector('video');v.src=''v.src.replace('blob:','')
      // 提取影片播放連結
      const videoSelector1 = 'video source[src]';
      // const videoSelector2 = 'video[src]';
      // 取得選擇器的多個元素

      const videoElements = document.querySelectorAll(videoSelector1);// || document.querySelector(videoSelector2);
      console.log(`Video Element (${videoSelector1}):`, videoElements.length ? 'Found' : 'Not Found');// || ${videoSelector2}
      const sourceUrls = Array.from(videoElements).map((videoElement) => videoElement.getAttribute('src'));

      const videoPlayUrl = sourceUrls.pop() || ''; // 取最後一個元素作為播放連結
      const cdnPlsyUrls = sourceUrls;
      console.log('Extracted Video Play URL:', videoPlayUrl);

      // 提取目前的 html
      const currentHtml = document.documentElement.outerHTML;
      // console.log('Extracted HTML:', currentHtml);
      console.log('--- Browser Evaluate End ---');

      // 返回包含所有所需資訊的物件
      return {
        title: title || '未知標題',
        releaseDate: releaseDate || '未知發布日期',
        videoPlayUrl: videoPlayUrl || '未知播放連結',
        cdnPlayUrls: cdnPlsyUrls || '未知 CDN 播放連結',
        userName: userName || '未知用戶名稱',
        userUrl: userUrl || '未知用戶 URL',
        html: currentHtml // 返回當前 HTML 以便調試
      };
    });

    // 檢查是否成功提取到必要資訊 (播放連結)
    // if (!extractedDetails || extractedDetails.videoPlayUrl === '未知播放連結') {
    console.log('提取的影片資訊xxx:', extractedDetails);
    // if (extractedDetails.html) {
    //   console.error('未能從 HTML 元素中提取到必要的影片播放連結。');
    //   // --- ADDED: Save HTML for debugging ---
    //   try {
    //     // const pageContent = await page.content();
    //     const debugHtmlPath = path.join(__dirname, 'debug_page.html');
    //     fs.writeFileSync(debugHtmlPath, extractedDetails.html);
    //     console.log(`頁面 HTML 已保存到 ${debugHtmlPath} 以便調試。`);
    //   } catch (writeError) {
    //     const err = writeError as Error;
    //     console.error('保存 debug_page.html 時出錯:', err.message);
    //   }
    //   // --- END ADDED ---
    //   // return null; // 播放連結是必須的
    // }

    console.log('成功從 HTML 元素提取到影片資訊！');
    // 返回只包含 title 和 videoPlayUrl 的物件
    return {
      title: extractedDetails.title,
      videoPlayUrl: extractedDetails.videoPlayUrl,
      userName: extractedDetails.userName,
      userUrl: extractedDetails.userUrl,
      releaseDate: extractedDetails.releaseDate
    };

  } catch (error) {
    const fetchError = error as Error;
    console.error(`使用 Puppeteer 爬取影片詳細資訊 ${videoUrl} 時發生錯誤:`, fetchError.message);
    console.error(fetchError.stack);
    return null;
  } finally {
    // --- 確保關閉瀏覽器 ---
    if (browser) {
      console.log('正在關閉 Puppeteer 瀏覽器...');
      await browser.close();
      console.log('Puppeteer 瀏覽器已關閉');
    }
  }
}

// 導出函數
export { parseDouyinShortUrl, fetchVideoDetails };

// --- 範例使用 (更新以打印新資訊) ---
async function runExample() {
  const shortLink = 'https://v.douyin.com/GQKypblX8bg/'; // 注意：URL 可能會過期
  console.log(`正在解析抖音短連結: ${shortLink}`);
  // 現在 parseDouyinShortUrl 直接返回標準 URL 或 null
  const standardVideoUrl = await parseDouyinShortUrl(shortLink);

  if (standardVideoUrl) {
    // 不再需要從 finalUrl 提取 ID 和構造 URL 的邏輯
    console.log(`\n解析完成。標準影片 URL: ${standardVideoUrl}`);

    const videoDetails = await fetchVideoDetails(standardVideoUrl);

    if (videoDetails) {
      console.log('\n--- 影片詳細資訊 ---');
      console.log(`發布日期: ${videoDetails.releaseDate}`);
      console.log(`用戶名稱: ${videoDetails.userName}`);
      console.log(`用戶 URL: ${videoDetails.userUrl}`);
      console.log(`標    題: ${videoDetails.title}`);
      console.log(`影片連結: ${videoDetails.videoPlayUrl}`);
      console.log('--------------------');
    } else {
      console.log('\n無法獲取影片詳細資訊。');
    }
  } else {
    console.log('\n解析短連結或提取標準 URL 失敗。');
  }
}

runExample();