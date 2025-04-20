// Copied from src/info/browser-manager.ts
// Original file path: src/info/browser-manager.ts
/**
 * 瀏覽器管理模組
 * 使用 Puppeteer 提供瀏覽器實例管理
 */

import { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import { infoLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Apply the stealth plugin
puppeteer.use(StealthPlugin());

// 瀏覽器管理器選項
interface BrowserManagerOptions {
  headless?: boolean; // 是否使用無頭模式
  timeout?: number; // 默認超時時間（毫秒）
  userAgent?: string; // 自定義 User-Agent
}

/**
 * 瀏覽器管理器
 * 使用單例模式管理 Puppeteer 瀏覽器實例
 */
export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private browserInitPromise: Promise<Browser> | null = null;
  private options: BrowserManagerOptions;

  /**
   * 獲取 BrowserManager 單例
   * @param options 瀏覽器選項
   * @returns BrowserManager 實例
   */
  public static getInstance(options: BrowserManagerOptions = {}): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager(options);
    }
    return BrowserManager.instance;
  }

  /**
   * 私有構造函數，防止直接創建實例
   * @param options 瀏覽器選項
   */
  private constructor(options: BrowserManagerOptions) {
    this.options = {
      headless: options.headless !== false, // 默認為 true (無頭模式)
      timeout: options.timeout || 30000,
      userAgent:
        options.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    };
  }

  /**
   * 獲取瀏覽器實例
   * 如果實例不存在，則創建新實例
   * @returns Promise<Browser>
   */
  async getBrowser(): Promise<Browser> {
    // 如果瀏覽器存在且已連接，直接返回
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    // 如果瀏覽器存在但已斷開連接，清除引用
    if (this.browser && !this.browser.isConnected()) {
      logger.debug('瀏覽器已斷開連接，將創建新實例');
      this.browser = null;
      this.browserInitPromise = null;
    }

    // 如果有正在進行的初始化，返回該 Promise
    if (this.browserInitPromise) {
      return this.browserInitPromise;
    }

    logger.debug('初始化 Puppeteer 瀏覽器...');

    // 配置啟動選項
    const launchOptions: PuppeteerLaunchOptions = {
      headless: this.options.headless as boolean,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-translate',
        '--metrics-recording-only'
      ],
      defaultViewport: { width: 1920, height: 1080 },
      timeout: this.options.timeout,
    };

    // 使用 Promise 處理初始化，避免多次初始化
    this.browserInitPromise = (async () => {
      try {
        const browser = await puppeteer.launch(launchOptions);

        // 監聽斷開連接事件
        browser.on('disconnected', () => {
          logger.debug('Puppeteer 瀏覽器已斷開連接');
          this.browser = null;
          this.browserInitPromise = null;
        });

        this.browser = browser;
        logger.debug('Puppeteer 瀏覽器已成功初始化');
        return browser;
      } catch (error) {
        const err = error as Error;
        logger.error('初始化 Puppeteer 瀏覽器失敗:', err);
        this.browserInitPromise = null;
        throw err;
      }
    })();

    return this.browserInitPromise;
  }

  /**
   * 創建新的頁面
   * @param cookies 可選的 Cookie 字符串
   * @returns Promise<Page>
   */
  async newPage(cookies?: string): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // 設置用戶代理
    await page.setUserAgent(this.options.userAgent || '');

    // 如果提供了 Cookie，則設置
    if (cookies) {
      await this.setCookies(page, cookies);
    }

    // 設置請求攔截（優化性能）
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      // 阻止加載不必要的資源
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    return page;
  }

  /**
   * 設置頁面的 Cookie
   * @param page Puppeteer 頁面實例
   * @param cookieString Cookie 字符串
   */
  async setCookies(page: Page, cookieString: string): Promise<void> {
    if (!cookieString) return;

    try {
      // 解析 Cookie 字符串
      const cookies = cookieString.split(';')
        .map(pair => {
          const parts = pair.trim().split('=');
          if (parts.length >= 2) {
            return {
              name: parts[0],
              value: parts.slice(1).join('='),
              domain: '.douyin.com' // 設置 domain 以確保 Cookie 生效
            };
          }
          return null;
        })
        .filter(cookie => cookie !== null) as any[];

      if (cookies.length > 0) {
        await page.setCookie(...cookies);
        logger.debug(`已設置 ${cookies.length} 個 Cookie`);
      }
    } catch (error) {
      const err = error as Error;
      logger.error('設置 Cookie 失敗:', err);
    }
  }

  /**
   * 關閉瀏覽器實例
   */
  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        logger.debug('Puppeteer 瀏覽器已關閉');
      } catch (error) {
        const err = error as Error;
        logger.error('關閉 Puppeteer 瀏覽器失敗:', err);
      } finally {
        this.browser = null;
        this.browserInitPromise = null;
      }
    }
  }
}

// 導出默認的瀏覽器管理器實例
export const browserManager = BrowserManager.getInstance();

// 清理函數，用於在進程退出時關閉瀏覽器
export async function cleanupBrowser(): Promise<void> {
  logger.debug('執行瀏覽器清理...');
  await browserManager.close();
}

// 處理進程退出
process.on('exit', () => {
  // 同步操作，無法使用 await
  logger.debug('進程退出，開始清理瀏覽器資源');
});

// 處理信號中斷（如 Ctrl+C）
process.on('SIGINT', async () => {
  logger.debug('收到 SIGINT 信號，開始清理瀏覽器資源');
  await cleanupBrowser();
  process.exit(0);
});

// 處理終止信號
process.on('SIGTERM', async () => {
  logger.debug('收到 SIGTERM 信號，開始清理瀏覽器資源');
  await cleanupBrowser();
  process.exit(0);
});