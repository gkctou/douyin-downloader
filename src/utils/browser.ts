/**
 * @deprecated 通用瀏覽器工具 - 已棄用。請改用 src/douyin/browser/manager.ts 中的函式。
 * 提供 Puppeteer 瀏覽器管理功能
 */

// Import puppeteer-extra and the stealth plugin (Keep for potential type usage, but functionality is deprecated)
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page, PuppeteerLaunchOptions, CookieParam } from 'puppeteer'; // Types still come from puppeteer
import { utilsLogger as logger } from './logger'; // Use the utils logger

// Apply the stealth plugin to puppeteer-extra (Keep for potential type usage, but functionality is deprecated)
// puppeteer.use(StealthPlugin()); // Comment out or remove actual usage

/**
 * @deprecated 瀏覽器管理器選項 - 已棄用。
 */
export interface BrowserManagerOptions {
  headless?: boolean | 'new' | 'shell' | undefined; // Allow all valid Puppeteer options + undefined
  timeout?: number; // 默認超時時間（毫秒）
  userAgent?: string; // 自定義 User-Agent
  executablePath?: string; // 指定瀏覽器可執行文件路徑
  userDataDir?: string; // 指定用戶數據目錄
}

/**
 * @deprecated 登入專用瀏覽器處理結果 - 已棄用。
 */
export interface LoginBrowserResult {
  page: Page;
  browser: Browser;
  cleanup: () => Promise<void>; // 用於清理資源的函數
}

/**
 * @deprecated 瀏覽器管理器 - 已棄用。請改用 src/douyin/browser/manager.ts 中的函式。
 * 使用單例模式管理 Puppeteer 瀏覽器實例
 */
export class BrowserManager {
  // Keep static instance for basic compatibility, but make it unusable
  private static instance: BrowserManager;
  // Remove internal state
  // private browser: Browser | null = null;
  // private browserInitPromise: Promise<Browser> | null = null;
  // private options: BrowserManagerOptions;

  /**
   * @deprecated 獲取 BrowserManager 單例 - 已棄用。
   * @param options 瀏覽器選項
   * @returns BrowserManager 實例
   */
  public static getInstance(options: BrowserManagerOptions = {}): BrowserManager {
    logger.error('DEPRECATED: BrowserManager.getInstance is deprecated. Use functions from src/douyin/browser/manager.ts instead.');
    if (!BrowserManager.instance) {
      // Still create instance to avoid breaking existing getInstance calls immediately, but log error.
      BrowserManager.instance = new BrowserManager(options);
    }
    return BrowserManager.instance;
  }

  /**
   * @deprecated 私有構造函數 - 已棄用。
   * @param options 瀏覽器選項
   */
  private constructor(options: BrowserManagerOptions) {
    // Log error only once during construction if instance didn't exist
    if (!BrowserManager.instance) {
        logger.error('DEPRECATED: BrowserManager constructor is deprecated and should not be used.');
    }
    // this.options = options; // Don't store options
  }

  /**
   * @deprecated 獲取瀏覽器實例 - 已棄用。
   * @returns Promise<Browser>
   */
  async getBrowser(): Promise<Browser> {
    logger.error('DEPRECATED: BrowserManager.getBrowser is deprecated. Use launchBrowser from src/douyin/browser/manager.ts.');
    throw new Error('BrowserManager.getBrowser is deprecated.');
  }

  /**
   * @deprecated 創建新的頁面 - 已棄用。
   * @returns Promise<Page>
   */
  async newPage(targetUrl?: string, cookies?: string, blockResources: boolean = true): Promise<Page> {
    logger.error('DEPRECATED: BrowserManager.newPage is deprecated. Use newPage from src/douyin/browser/manager.ts.');
    throw new Error('BrowserManager.newPage is deprecated.');
  }

  /**
   * @deprecated 創建用於登入的獨立瀏覽器實例 - 已棄用。
   * @returns Promise<LoginBrowserResult>
   */
  async newLoginBrowser(options: {
    timeout?: number;
    userAgent?: string;
    executablePath?: string;
    userDataDir?: string;
  } = {}): Promise<LoginBrowserResult> {
    logger.error('DEPRECATED: BrowserManager.newLoginBrowser is deprecated. Use launchLoginBrowser from src/douyin/browser/manager.ts.');
    throw new Error('BrowserManager.newLoginBrowser is deprecated.');
  }

  /**
   * @deprecated 設置頁面的 Cookie - 已棄用。
   */
  async setCookies(page: Page, cookieString: string | undefined, domain?: string): Promise<void> {
    logger.error('DEPRECATED: BrowserManager.setCookies is deprecated. Use setCookiesOnPage from src/douyin/browser/manager.ts.');
    throw new Error('BrowserManager.setCookies is deprecated.');
  }

  /**
   * @deprecated 關閉瀏覽器實例 - 已棄用。
   */
  async close(): Promise<void> {
    logger.warn('DEPRECATED: BrowserManager.close is deprecated and does nothing. Browser lifecycle should be managed explicitly using closeBrowser from src/douyin/browser/manager.ts.');
    // No operation
  }
}

// 導出默認的瀏覽器管理器實例
/** @deprecated Use functions from src/douyin/browser/manager.ts instead. */
export const browserManager = BrowserManager.getInstance();

// 清理函數，用於在進程退出時關閉瀏覽器
/** @deprecated Browser lifecycle should be managed explicitly using closeBrowser from src/douyin/browser/manager.ts. */
export async function cleanupBrowser(): Promise<void> {
  logger.warn('DEPRECATED: cleanupBrowser is deprecated and does nothing. Ensure browsers are closed explicitly using closeBrowser from src/douyin/browser/manager.ts.');
  // Do nothing
}

// --- Process Exit Handling ---
// Removed all process exit handling as the singleton is deprecated