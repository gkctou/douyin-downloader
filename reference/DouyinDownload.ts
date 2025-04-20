import puppeteer, { Browser, Page, HTTPRequest, CookieParam } from 'puppeteer'; // 引入 CookieParam
import * as fs from 'fs'; // 引入 fs
import * as path from 'path'; // 引入 path
import { fileURLToPath } from 'url'; // 引入 fileURLToPath

// 定義回調函數的類型接口
interface CallbackData {
    status: number;
    video_url: string;
    title: string;
}

type VideoCallback = (data: CallbackData) => void;

// 定義 DouYin 類的選項接口
interface DouYinOptions {
    userAgent?: string;
}

let browser: Browser | null = null;
let browserInitializationPromise: Promise<Browser | null> | null = null;

// 改進的瀏覽器初始化函數
async function initializeBrowser(): Promise<Browser | null> {
    if (browser) {
        return browser;
    }
    if (browserInitializationPromise) {
        return browserInitializationPromise;
    }

    console.log('Initializing Puppeteer browser...');
    browserInitializationPromise = (async () => {
        try {
            const newBrowser = await puppeteer.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage', // 解決 Docker 環境下的問題
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    // '--single-process', // 可能導致不穩定，謹慎使用
                    '--disable-gpu' // 在無頭模式下通常需要
                ]
            });
            console.log('Puppeteer browser launched successfully.');
            browser = newBrowser; // 將成功初始化的瀏覽器賦值給全局變量
             // 監聽瀏覽器斷開連接事件
            browser.on('disconnected', () => {
                console.error('Puppeteer browser disconnected.');
                browser = null; // 重置瀏覽器實例
                browserInitializationPromise = null; // 允許重新初始化
                // 可以考慮在這裡添加自動重連邏輯或通知機制
            });
            return browser;
        } catch (error) {
            console.error('Failed to launch Puppeteer browser:', error);
            browserInitializationPromise = null; // 失敗後允許重試
            return null; // 返回 null 表示失敗
        }
    })();
    return browserInitializationPromise;
}

// 立即開始初始化瀏覽器
initializeBrowser();


class DouYin {
    private userAgent: string;

    constructor(opt?: DouYinOptions) {
        this.userAgent = opt?.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"; // 更新 User Agent
    }

    async getVideo(url: string, callback: VideoCallback): Promise<void> {
        if (!url) {
            console.error("URL is empty");
            callback({ status: 1, video_url: "#", title: "URL 不得為空!" });
            return;
        }

        // 等待瀏覽器初始化完成
        const currentBrowser = await initializeBrowser();

        if (!currentBrowser) {
            console.error("Browser is not initialized and failed to launch.");
            callback({ status: 1, video_url: "#", title: "瀏覽器初始化失敗!" });
            return;
        }

        let page: Page | null = null;

        try {
            page = await currentBrowser.newPage();
            await page.setUserAgent(this.userAgent);
            await page.setViewport({ width: 1280, height: 800 }); // 設置視口

            // --- 讀取和設定 Cookie ---
            let cookieString = '';
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const cookiePath = path.join(__dirname, 'cookie_.txt'); // 假設 cookie 文件在同一目錄

            try {
                cookieString = fs.readFileSync(cookiePath, 'utf-8').trim();
                console.log('成功讀取 cookie.txt');
            } catch (err) {
                const error = err as Error;
                console.warn(`讀取 cookie.txt 失敗 (路徑: ${cookiePath}): ${error.message}。將不使用 Cookie 進行請求。`);
            }

            if (cookieString) {
                try {
                    // 先 map 再 filter，讓 TypeScript 正確推斷類型
                    const cookies = cookieString.split(';')
                        .map(pair => {
                            const parts = pair.trim().split('=');
                            if (parts.length >= 2) {
                                // 創建符合 CookieParam 結構的對象
                                const cookie: CookieParam = {
                                    name: parts[0],
                                    value: parts.slice(1).join('='),
                                    domain: '.douyin.com' // domain 對於 setCookie 通常是必要的
                                };
                                return cookie;
                            }
                            return null;
                        })
                        .filter((cookie): cookie is CookieParam => cookie !== null); // 使用類型守衛過濾 null

                    if (cookies.length > 0) {
                        await page.setCookie(...cookies);
                        console.log('已成功設定 Cookie');
                    } else {
                        console.log('Cookie 字串解析後為空或無效，未設定 Cookie');
                    }
                } catch (cookieError) {
                     console.error('設定 Cookie 時發生錯誤:', cookieError);
                }
            }
            // --- Cookie 設定結束 ---

            // 請求攔截
            await page.setRequestInterception(true);
            page.on('request', (request: HTTPRequest) => {
                const resourceType = request.resourceType();
                const blockedTypes = ['image', 'media', 'font', 'stylesheet', 'other', 'manifest', 'texttrack'];
                // 允許 'document', 'script', 'xhr', 'fetch'
                if (blockedTypes.includes(resourceType)) {
                    request.abort().catch(e => console.warn(`Failed to abort request: ${request.url()}`, e.message));
                } else {
                    request.continue().catch(e => console.warn(`Failed to continue request: ${request.url()}`, e.message));
                }
            });

            console.log(`Navigating to ${url}...`);
            // 使用 networkidle0 可能更可靠，但超時風險更高
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            console.log(`Navigation to ${url} complete.`);

            // 等待視頻元素加載
            console.log('Waiting for video element...');
            // 嘗試更通用的選擇器，並增加超時
            const videoSelector = 'video source[src]'; // 保持這個選擇器，如果不行再嘗試 'video'
            try {
                await page.waitForSelector(videoSelector, { timeout: 45000 });
                console.log('Video element found.');
            } catch (waitError) {
                 console.error(`Timeout waiting for selector "${videoSelector}". Trying generic 'video' selector.`);
                 await page.waitForSelector('video', { timeout: 15000 }); // 備用選擇器
                 console.log('Generic video element found.');
            }


            // 使用 Promise 來處理 exposeFunction 的異步回調
            const videoInfoPromise = new Promise<CallbackData>((resolve, reject) => {
                page?.exposeFunction('nodelog', (src: string | null, title: string | null) => {
                    console.log(`Callback received - src: ${src ? 'found' : 'not found'}, title: ${title ? 'found' : 'not found'}`);
                    if (src && title) {
                        resolve({ status: 0, video_url: src, title: title });
                    } else {
                        // 如果信息不完整，可以選擇 reject 或 resolve 一個錯誤狀態
                         console.warn("Incomplete video info received from page.");
                         // 這裡我們不立即 reject，給 evaluate 一個機會。
                         // 如果 evaluate 也失敗，外層的 catch 會處理。
                         // 或者，設置一個標誌，如果 evaluate 後仍未 resolve，則 reject。
                    }
                }).catch(reject); // 捕獲 exposeFunction 可能的錯誤

                 // 在頁面執行腳本以獲取信息
                page?.evaluate(async () => {
                    console.log('Evaluating page for video info...');
                    // 嘗試多種方式獲取 video 元素
                    const videoElement = document.querySelector("video[src]") || document.querySelector("video source[src]");
                    // 嘗試多種方式獲取 title
                    const h1Element = document.querySelector("h1");
                    const titleMeta = document.querySelector('meta[property="og:title"]');
                    const titleTag = document.querySelector('title');

                    let src: string | null = null;
                    let title: string | null = null;

                    if (videoElement) {
                        src = videoElement.getAttribute("src");
                        // 有些網站 src 可能在 source 標籤裡
                        if (!src) {
                            const sourceElement = videoElement.querySelector('source[src]');
                            if (sourceElement) {
                                src = sourceElement.getAttribute('src');
                            }
                        }
                    }

                    if (h1Element) {
                        title = h1Element.textContent?.trim() || null;
                    }
                    if (!title && titleMeta) {
                         title = titleMeta.getAttribute('content')?.trim() || null;
                    }
                     if (!title && titleTag) {
                         title = titleTag.textContent?.trim() || null;
                    }
                    // 如果還沒有標題，嘗試從 URL 中提取
                    if (!title) {
                        try {
                            const urlParts = window.location.pathname.split('/');
                            const potentialTitle = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
                            if (potentialTitle) {
                                title = decodeURIComponent(potentialTitle).replace(/[\-_]/g, ' ');
                            }
                        } catch (e) { /* 忽略提取錯誤 */ }
                    }
                     if (!title) {
                         title = "Untitled Video"; // 提供默認標題
                     }


                    console.log(`Evaluate found - src: ${src ? 'found' : 'not found'}, title: ${title ? 'found' : 'not found'}`);
                    // @ts-ignore
                    await window.nodelog(src, title);
                }).catch(evalError => {
                    console.error("Error during page evaluation:", evalError);
                    reject(new Error("頁面腳本執行錯誤!")); // 如果 evaluate 出錯，reject Promise
                });

                 // 添加超時機制，防止 exposeFunction 回調永遠不被觸發
                setTimeout(() => {
                    reject(new Error("獲取視頻信息超時"));
                }, 60000); // 60 秒超時
            });

            // 等待 videoInfoPromise 完成
            const result = await videoInfoPromise;
            callback(result);

        } catch (e: any) {
            console.error("Error processing video:", e);
            // 確保錯誤信息更具體
            const errorMessage = e.message.includes('Timeout') ? "頁面加載或元素等待超時!" : "處理視頻時發生未知錯誤!";
            callback({ status: 1, video_url: "#", title: errorMessage });
        } finally {
            if (page && !page.isClosed()) {
                console.log('Closing page...');
                await page.close().catch(e => console.error("Failed to close page:", e));
                console.log('Page closed.');
            }
        }
    }

    // 關閉瀏覽器的方法
    async closeBrowser(): Promise<void> {
        const currentBrowser = await initializeBrowser(); // 確保獲取到的是當前實例
        if (currentBrowser) {
            console.log('Closing Puppeteer browser...');
            await currentBrowser.close();
            browser = null; // 重置全局變量
            browserInitializationPromise = null; // 重置 Promise
            console.log('Puppeteer browser closed.');
        } else {
             console.log('Browser already closed or not initialized.');
        }
    }
}

// 優化進程退出處理
async function cleanup() {
    console.log('Cleanup process started...');
    if (browser && !browser.isConnected()) {
        console.log('Browser already disconnected.');
        browser = null;
        browserInitializationPromise = null;
    } else if (browser) {
        console.log('Closing browser during cleanup...');
        try {
            await browser.close();
            console.log('Browser closed successfully during cleanup.');
        } catch (e) {
            console.error('Error closing browser during cleanup:', e);
        } finally {
            browser = null;
            browserInitializationPromise = null;
        }
    } else {
        console.log('No active browser instance to close.');
    }
}

// 捕獲退出信號
process.on('exit', cleanup);
// 處理 SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
    console.log('SIGINT received. Starting cleanup...');
    await cleanup();
    process.exit(0); // 確保進程退出
});
// 處理 SIGTERM (kill)
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Starting cleanup...');
    await cleanup();
    process.exit(0); // 確保進程退出
});
// 處理未捕獲的異常
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await cleanup();
    process.exit(1); // 以錯誤碼退出
});
// 處理未處理的 Promise rejection
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // 根據情況決定是否退出
    // await cleanup();
    // process.exit(1);
});


// export default DouYin;
// 示例用法
const dyDownloader = new DouYin();
dyDownloader.getVideo('https://www.douyin.com/video/7440784860962147611', (result) => {
    if (result.status === 0) {
        console.log(`成功獲取視頻: ${result.title}`);
        console.log(`視頻URL: ${result.video_url}`);
    } else {
        console.error(`獲取視頻失敗: ${result.title}`);
    }
});

// 使用完畢後關閉瀏覽器
// dyDownloader.closeBrowser();

export default DouYin;
