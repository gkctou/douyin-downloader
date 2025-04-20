// Copied from src/auth/login.ts
// Original file path: src/auth/login.ts
/**
 * 瀏覽器自動化登入
 * 提供抖音自動化登入功能
 */

import { Page, Browser } from 'puppeteer';
// import { browserManager, LoginBrowserResult } from '../../utils/browser'; // Removed old import
import { saveCookie } from './cookie-storage';
import { getDefaultCookiePath } from './cookie-path';
import { LoginError } from './errors';
import { authLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { launchLoginBrowser, LaunchOptions } from '../../douyin/browser/manager'; // Import new login browser function and options type

// 抖音登入 URL
const LOGIN_URL = 'https://www.douyin.com/';
// 登入成功所需的所有必要 Cookie 名稱
const LOGIN_SUCCESS_COOKIE_NAMES = ['login_time','IsDouyinActive','passport_assist_user'];//['ttwid', 'sessionid', 'uid_tt', 'sid_tt'];

/**
 * 登入選項
 */
export interface LoginOptions {
  timeout?: number;        // 登入超時時間（毫秒）
  headless?: boolean;      // 是否以無頭模式運行瀏覽器 (Note: launchLoginBrowser forces false)
  browserType?: 'chromium' | 'firefox' | 'webkit'; // 使用的瀏覽器類型 (Note: currently ignored by launchLoginBrowser)
  userAgent?: string;      // 自定義 User-Agent
  autoCleanup?: boolean;   // 是否在獲取 Cookie 後自動清理瀏覽器資源
  initialCookie?: string;  // 可選的初始 Cookie 字串或檔案路徑 (將在 CLI 層處理檔案讀取)
  // Add options supported by LaunchOptions if needed
  executablePath?: string;
  userDataDir?: string;
}

/**
 * 登入結果 (保持與舊版兼容)
 */
export interface LoginResult {
  cookie: string;          // 登入成功後的 Cookie 字串
  cleanup: () => Promise<void>; // 清理瀏覽器資源的函數
}

/**
 * 登入抖音並獲取 Cookie
 * 打開瀏覽器進行登入操作，獲取有效的 cookie 字串。
 * @param savePath 可選的 Cookie 儲存路徑
 * @param options 登入選項
 * @returns Promise<string | LoginResult> 如果 autoCleanup 為 true，則只返回 cookie 字串；否則返回包含 cookie 和 cleanup 函數的對象
 * @throws {LoginError} 如果登入過程中出現錯誤
 */
export async function login(savePath?: string, options: LoginOptions = {}): Promise<string | LoginResult> {
  // Define type for the result of launchLoginBrowser
  type LoginBrowserLaunchResult = { browser: Browser; page: Page; cleanup: () => Promise<void> };
  let browserResult: LoginBrowserLaunchResult | null = null;
  let page: Page | null = null; // Keep page variable for consistency

  try {
    logger.info('開始登入抖音...');

    // Map LoginOptions to LaunchOptions for launchLoginBrowser
    const launchOpts: LaunchOptions = {
        timeout: options.timeout,
        userAgent: options.userAgent,
        executablePath: options.executablePath, // Pass through if provided
        userDataDir: options.userDataDir,       // Pass through if provided
        headless: false // Explicitly set headless to false for login
    };

    // Use the new launchLoginBrowser function
    browserResult = await launchLoginBrowser(launchOpts);

    page = browserResult.page; // Assign page from the result

    // 監聽控制台消息
    page?.on('console', (msg: any) => logger.debug('瀏覽器控制台:', msg.text()));

    // 導航到登入頁面
    logger.info(`導航至 ${LOGIN_URL}...`);
    if (!page) throw new Error('無法獲取瀏覽器頁面');

    // --- 在導航前設定初始 Cookie ---
    if (options.initialCookie) {
      logger.info('正在設定初始 Cookie...');
      try {
        const cookiesToSet = options.initialCookie.split(';').map(pair => {
          const parts = pair.trim().split('=');
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const value = parts.slice(1).join('=').trim(); // Keep original value
             if (!name || value === undefined) return null;
            // Match reference/DouyinParser.ts: Use hardcoded domain
            const domain = '.douyin.com';
            return { name, value, domain };
          }
          return null;
        }).filter(cookie => cookie !== null); // Simple filter

        if (cookiesToSet.length > 0) {
            // Use 'as any[]' like reference
          await page.setCookie(...cookiesToSet);
          logger.info(`成功設定 ${cookiesToSet.length} 個初始 Cookie`);
        } else {
          logger.warn('提供的 initialCookie 字串解析後為空或無效');
        }
      } catch (e) {
        const cookieErr = e instanceof Error ? e : new Error(String(e));
        logger.error('設定初始 Cookie 時出錯:', cookieErr);
      }
    }
    // --- 結束設定初始 Cookie ---

    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: options.timeout || 60000 });

    logger.info('請在瀏覽器中完成登入...');
    logger.info(`等待登入完成，檢測到所有必要的 Cookie (${LOGIN_SUCCESS_COOKIE_NAMES.join(', ')}) 都存在後將自動獲取 Cookie`);

    // 等待登入成功的標誌
    if (!page) throw new Error('無法獲取瀏覽器頁面');
    await page.waitForFunction(
      (cookieNames) => {
        const cookieObj: Record<string, string> = {};
        document.cookie.split(';').forEach(cookie => {
          const parts = cookie.trim().split('=');
          if (parts.length >= 2) {
            const name = parts[0];
            const value = parts.slice(1).join('=');
            cookieObj[name] = decodeURIComponent(value);
          }
        });
        // console.log('cookieObj', cookieObj); // Keep for debugging if needed
        return cookieNames.every(name =>
          cookieObj[name] !== undefined &&
          cookieObj[name].trim() !== ''
        );
      },
      { polling: 1000, timeout: options.timeout || 300000 },
      LOGIN_SUCCESS_COOKIE_NAMES
    );

    logger.info('登入成功，正在獲取 Cookie...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 獲取當前頁面的 Cookie
    if (!page) throw new Error('無法獲取瀏覽器頁面');
    const cookies = await page.cookies();

    // 格式化 Cookie 字串
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
      .join('; ');

    // 檢查所有必要的 Cookie 是否存在
    const missingCookies = LOGIN_SUCCESS_COOKIE_NAMES.filter(name =>
      !cookies.some(cookie => cookie.name === name)
    );
    if (missingCookies.length > 0) {
      logger.warn(`有些必要的 Cookie 缺失: ${missingCookies.join(', ')}`);
    }

    logger.info(`成功獲取 Cookie，共 ${cookies.length} 個`);

    // 儲存 Cookie
    const finalSavePath = savePath || getDefaultCookiePath();
    if (finalSavePath) { // Ensure savePath is valid before saving
        await saveCookie(cookieString, finalSavePath);
        logger.info(`Cookie 已儲存至 ${finalSavePath}`);
    }


    // Ensure browserResult is not null before accessing its properties
    if (!browserResult) {
        throw new Error("Browser result is unexpectedly null after successful login flow.");
    }

    // If autoCleanup is true (default), cleanup and return only the cookie string
    if (options.autoCleanup !== false) {
      logger.debug('自動清理瀏覽器資源');
      await browserResult.cleanup();
      return cookieString;
    }

    // Return the structure matching LoginResult if autoCleanup is false
    return { cookie: cookieString, cleanup: browserResult.cleanup };

  } catch (error) {
    // 處理錯誤
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObject = error instanceof Error ? error : new Error(String(error));
    logger.error('登入失敗:', errorObject);

    // 嘗試清理資源
    if (browserResult) {
      try {
        await browserResult.cleanup();
      } catch (cleanupError) {
        const cleanupErr = cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError));
        logger.error('清理登入瀏覽器資源失敗:', cleanupErr);
      }
    }

    // 創建一個新的 LoginError
    const err = new LoginError(`登入失敗: ${errorMessage}`);
    throw err;
  }
}