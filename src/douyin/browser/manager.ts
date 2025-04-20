// src/douyin/browser/manager.ts

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page, PuppeteerLaunchOptions, CookieParam } from 'puppeteer';
import { utilsLogger as logger } from '../../utils/logger'; // 確保路徑正確
import envPaths from 'env-paths'; // 匯入 env-paths
import path from 'path'; // 匯入 path 模組
import fs from 'fs'; // 匯入 fs 模組

// 應用 stealth plugin (理想情況下應在應用程式入口點執行一次)
// 暫時放在這裡以保持模組封裝性
// 使用 !puppeteer.plugins.some(...) 檢查確保只應用一次
if (!puppeteer.plugins.find((p: any) => p.name === 'stealth')) {
    puppeteer.use(StealthPlugin());
    logger.debug('Stealth plugin applied to puppeteer-extra in browser manager.');
}


// --- 預設 User Data Directory ---
// 定義應用程式名稱
const APP_NAME = 'douyin-downloader';
// 獲取標準路徑
const paths = envPaths(APP_NAME, { suffix: '' }); // suffix: '' 避免額外的 'nodejs' 路徑
// 建立 Puppeteer 專用的資料目錄路徑
const puppeteerUserDataPath = path.join(paths.data, 'puppeteer');
// 確保目錄存在
try {
    fs.mkdirSync(puppeteerUserDataPath, { recursive: true });
    logger.debug(`預設 Puppeteer User Data Directory 設定為: ${puppeteerUserDataPath}`);
} catch (error) {
    logger.error(`無法創建預設 Puppeteer User Data Directory (${puppeteerUserDataPath}):`, error);
    // 如果無法創建，則不設定預設值，讓 Puppeteer 使用其內部預設
}
// ---

/**
 * 瀏覽器啟動選項
 */
export interface LaunchOptions {
    // Use Puppeteer's headless type directly. Handle 'new' case in logic if needed.
    headless?: PuppeteerLaunchOptions['headless'] | 'new'; // Keep 'new' for input flexibility, map it later
    timeout?: number; // 預設超時 (毫秒)
    userAgent?: string; // 自定義 User-Agent
    executablePath?: string; // 瀏覽器執行檔路徑
    userDataDir?: string; // 用戶數據目錄
    blockResources?: boolean; // 是否預設阻擋頁面資源
    args?: string[]; // 允許傳遞自定義參數
}

/**
 * 啟動一個新的 Puppeteer 瀏覽器實例。
 * @param options 啟動選項
 * @returns Promise<Browser>
 */
export async function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
    logger.debug('啟動新的 Puppeteer 瀏覽器實例...', options);

    let headlessOption: PuppeteerLaunchOptions['headless'];
    if (options.headless === 'shell') {
        headlessOption = 'shell';
    } else if (options.headless === false) {
        headlessOption = false;
    } else {
        // 預設為新版無頭模式 (如果未定義或為 true)
        // 注意: @types/puppeteer 可能不直接支援 'new' 字面值，使用 true 作為替代
        // 預設為新版無頭模式 (如果未定義或為 true)
        // 注意: @types/puppeteer 可能不直接支援 'new' 字面值，使用 true 作為替代
        // headlessOption = true; // Keep previous logic for reference
        // Match reference/DouyinParser.ts: force non-headless for login, allow override?
        // For launchBrowser (general purpose), let's keep the flexible option
        // For launchLoginBrowser, it forces headless: false

        // Map 'new' to true, otherwise use the provided value or default undefined to true.
        if (options.headless === 'new') {
            headlessOption = true; // Map 'new' to classic headless (true)
            logger.debug("Mapping headless: 'new' to headless: true");
        } else {
            // Assign 'shell', false, true directly. Default undefined to true.
            headlessOption = options.headless === undefined ? true : options.headless;
        }
    }

    // Revert to more comprehensive args, keeping lang setting
    const defaultArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Crucial for Docker/CI environments
        // '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        // '--disable-gpu', // Often needed in headless environments
        // '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        // '--disable-popup-blocking',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--enable-automation',
        '--disable-infobars', // Hide "Chrome is controlled by automated test software"
        '--disable-blink-features=AutomationControlled', // Further hide automation flags
        '--window-size=1920,1080', // Set window size via args
        '--lang=zh-CN' // Keep language setting
    ];

    if (!options.userDataDir)
        logger.debug('未提供 userDataDir，將使用預設路徑:', puppeteerUserDataPath);
    const launchOptions: PuppeteerLaunchOptions = {
        headless: headlessOption,
        executablePath: options.executablePath,
        // 優先使用選項中提供的 userDataDir，否則使用 env-paths 計算出的預設路徑 (如果成功創建)
        userDataDir: options.userDataDir ?? (fs.existsSync(puppeteerUserDataPath) ? puppeteerUserDataPath : undefined),
        args: [...defaultArgs, ...(options.args || [])], // Combine default and custom args
        defaultViewport: { width: 1920, height: 1080 }, // Keep null when using window-size arg
        timeout: options.timeout || 60000,
        env: { // Add environment variable for language
            ...process.env, // Inherit existing env vars
            LANG: 'zh_CN.UTF-8'
        }
    };

    try {
        const browser = await puppeteer.launch(launchOptions);
        const pid = browser.process()?.pid;
        logger.debug(`Puppeteer 瀏覽器已成功啟動 (PID: ${pid})`);

        // 監聽斷開連接事件
        browser.on('disconnected', () => {
            logger.warn(`Puppeteer 瀏覽器 (PID: ${pid}) 已斷開連接。`);
        });

        // 將啟動選項附加到瀏覽器實例上，供 newPage 使用
        (browser as any).__launchOptions = options;

        return browser;
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('啟動 Puppeteer 瀏覽器失敗:', err);
        // 考慮拋出更具體的錯誤類型
        throw new Error(`無法啟動瀏覽器: ${err.message}`);
    }
}

/**
 * 在指定的瀏覽器實例中創建一個新頁面。
 * 應用通用設定，如 User-Agent 和資源攔截。
 * @param browser 瀏覽器實例
 * @param options 創建頁面的選項 (可覆蓋瀏覽器啟動時的選項)
 * @returns Promise<Page>
 */
export async function newPage(browser: Browser, options: {
    userAgent?: string;
    blockResources?: boolean;
    timeout?: number;
} = {}): Promise<Page> {
    // 從瀏覽器實例獲取啟動選項作為預設值
    const browserLaunchOptions: LaunchOptions = (browser as any).__launchOptions || {};
    // 合併選項，優先使用 newPage 傳入的選項
    const pageOptions = {
        // Update default User-Agent to match reference/DouyinParser.ts
        userAgent: options.userAgent ?? browserLaunchOptions.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        blockResources: options.blockResources ?? browserLaunchOptions.blockResources ?? false, // 預設阻擋資源
        timeout: options.timeout ?? browserLaunchOptions.timeout ?? 60000, // 使用瀏覽器或預設超時
    };

    logger.debug(`準備獲取或創建新頁面，選項:`, pageOptions);

    let page: Page;
    const pages = await browser.pages();

    // 檢查是否存在一個 'about:blank' 頁面可供重複使用
    if (pages.length === 1 && pages[0].url() === 'about:blank') {
        logger.debug('發現一個現有的 about:blank 頁面，將重複使用它。');
        page = pages[0];
    } else {
        logger.debug('未找到可重複使用的 about:blank 頁面，創建新頁面。');
        page = await browser.newPage();
    }

    try {
        // 設定 User-Agent
        await page.setUserAgent(pageOptions.userAgent);

        // 設定 Accept-Language HTTP 標頭
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'zh-CN,zh;q=0.9' // Prefer Simplified Chinese
        });
        logger.debug('Accept-Language header set to zh-CN');

        // 設定請求攔截 (資源阻擋)
        if (pageOptions.blockResources) {
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const resourceType = request.resourceType();
                // 阻擋圖片、樣式表、字體、媒體資源
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {//
                    request.abort().catch(e => logger.debug(`無法中止請求 ${request.url()}: ${e.message}`)); // 改用 debug 級別
                } else {
                    request.continue().catch(e => logger.debug(`無法繼續請求 ${request.url()}: ${e.message}`)); // 改用 debug 級別
                }
            });
        }

        // 設定預設超時
        page.setDefaultNavigationTimeout(pageOptions.timeout * 2); // 導航超時設為兩倍
        page.setDefaultTimeout(pageOptions.timeout);

        logger.debug(`頁面創建成功。`);
        return page;
    } catch (error) {
        logger.error('配置新頁面失敗:', error);
        // 如果頁面已創建但配置失敗，嘗試關閉它
        if (!page.isClosed()) {
            await page.close().catch(e => logger.error('配置錯誤後關閉頁面失敗:', e));
        }
        throw error; // 重新拋出錯誤
    }
}


/**
 * 在指定的頁面上設置 Cookie。
 * @param page Puppeteer 頁面實例
 * @param cookieString Cookie 字串 (例如來自 document.cookie)
 * @param domain 可選: Cookie 的域。如果未提供，則嘗試從頁面 URL 推斷。
 */
export async function setCookiesOnPage(page: Page, cookieString: string | undefined, domain: string = '.douyin.com'): Promise<void> {
    if (!cookieString) {
        logger.debug('未提供 cookie 字串，跳過 setCookiesOnPage。');
        return;
    }

    let targetDomain = domain;
    const pageUrl = page.url();

    // 如果未提供 domain，嘗試從 page URL 推斷
    if (!targetDomain && pageUrl && pageUrl !== 'about:blank') {
        try {
            targetDomain = new URL(pageUrl).hostname;
        } catch (e) {
            logger.warn(`無法從 URL 解析 domain: ${pageUrl}`, e);
        }
    }

    if (!targetDomain) {
        logger.warn(`無法確定 Cookie 的域 (URL: ${pageUrl})。跳過設置 Cookie。`);
        return;
    }

    try {
        // Match reference/DouyinParser.ts: Use hardcoded domain
        const cookieDomain = '.douyin.com';
        logger.debug(`解析 Cookie，將使用固定 domain: ${cookieDomain} 進行設置`);

        // 解析 Cookie 字串 (Simplified like reference)
        const cookiesToSet = cookieString.split(';')
            .map(pair => {
                const parts = pair.trim().split('=');
                if (parts.length >= 2) {
                    const name = parts[0].trim();
                    const value = parts.slice(1).join('=').trim(); // Keep original value, don't decode like current code
                    if (!name || value === undefined) return null;
                    // Set name, value, domain, and a far-future expires date for persistence
                    const farFuture = new Date();
                    farFuture.setFullYear(farFuture.getFullYear() + 1); // Expire in 1 year
                    return {
                        name,
                        value,
                        domain: cookieDomain,
                        expires: farFuture.getTime() / 1000, // Puppeteer expects Unix timestamp in seconds
                        path: '/' // Add common path
                    };
                }
                return null;
            })
            .filter(cookie => cookie !== null); // Simple filter

        if (cookiesToSet.length > 0) {
            // Use 'as any[]' like reference, although CookieParam[] should work if types match
            await page.setCookie(...(cookiesToSet as any[]));
            logger.debug(`為域 ${cookieDomain} 設置了 ${cookiesToSet.length} 個 Cookie`);
        } else {
            logger.warn(`從字串解析後沒有有效的 Cookie 可設置: "${cookieString}"`);
        }
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(`設置 Cookie 失敗 (Domain: ${domain}, URL: ${pageUrl}):`, err);
        // 可選擇重新拋出錯誤或進行其他處理
    }
}

/**
 * 安全地關閉瀏覽器實例。
 * @param browser 要關閉的瀏覽器實例
 */
export async function closeBrowser(browser: Browser | null): Promise<void> {
    if (browser && browser.isConnected()) {
        const pid = browser.process()?.pid;
        logger.debug(`正在關閉瀏覽器實例 (PID: ${pid})...`);
        try {
            await browser.close();
            logger.debug(`瀏覽器實例 (PID: ${pid}) 已成功關閉。`);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`關閉瀏覽器實例 (PID: ${pid}) 失敗:`, err);
            // 根據需要決定是否重新拋出錯誤
        }
    } else {
        logger.debug('瀏覽器實例已關閉或為 null。');
    }
}

/**
 * 創建一個專用於登入的瀏覽器實例 (非無頭模式)。
 * 返回瀏覽器、頁面和一個清理函數。
 * @param options 登入瀏覽器的特定啟動選項
 * @returns Promise<{ browser: Browser; page: Page; cleanup: () => Promise<void> }>
 */
export async function launchLoginBrowser(options: LaunchOptions = {}): Promise<{ browser: Browser; page: Page; cleanup: () => Promise<void> }> {
    logger.info('啟動專用登入瀏覽器 (非無頭模式)...');

    // 強制非無頭模式，並可能使用不同的用戶數據目錄
    const loginOptions: LaunchOptions = {
        ...options,
        headless: false, // 確保非無頭
        blockResources: options.blockResources ?? false, // 登入時通常需要看到所有內容
        timeout: options.timeout || 120000, // 為手動登入設置更長的超時
    };

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        // 使用通用的 launchBrowser 啟動瀏覽器
        browser = await launchBrowser(loginOptions);
        // 使用通用的 newPage 創建頁面，繼承部分選項
        page = await newPage(browser, {
            blockResources: loginOptions.blockResources,
            timeout: loginOptions.timeout,
            userAgent: loginOptions.userAgent, // 傳遞指定的 User Agent
        });

        // 特別為登入互動增加超時時間
        page.setDefaultNavigationTimeout(loginOptions.timeout! * 2); // 使用 ! 斷言 timeout 已有預設值
        page.setDefaultTimeout(loginOptions.timeout!);

        // 創建清理函數
        const cleanup = async (): Promise<void> => {
            logger.debug('開始清理登入瀏覽器資源...');
            // 先關閉頁面，再關閉瀏覽器
            if (page && !page.isClosed()) {
                try {
                    await page.close();
                    logger.debug('登入頁面已關閉。');
                } catch (e) {
                    logger.error('關閉登入頁面時出錯:', e);
                }
            }
            // 使用通用的 closeBrowser 函數
            await closeBrowser(browser);
            logger.debug('登入瀏覽器清理完成。');
        };

        return { browser, page, cleanup };

    } catch (error) {
        logger.error('啟動或配置登入瀏覽器失敗:', error);
        // 如果部分組件已創建，嘗試清理
        if (page && !page.isClosed()) await page.close().catch(e => logger.error('登入瀏覽器清理過程中關閉頁面出錯:', e));
        if (browser) await closeBrowser(browser); // 嘗試關閉瀏覽器
        throw error; // 重新拋出原始錯誤
    }
}