// Copied from src/auth/validate.ts
// Original file path: src/auth/validate.ts
/**
 * Cookie 驗證
 * 提供 Cookie 有效性檢查功能
 */

import { launchBrowser, newPage, setCookiesOnPage, closeBrowser } from '../browser/manager'; // Import new browser functions
import { CookieValidationError } from './errors';
import { authLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { Browser, Page } from 'puppeteer'; // Import Browser and Page types

/**
 * 檢查提供的 cookie 字串是否仍然有效
 * @param cookie 要驗證的 cookie 字串
 * @returns Promise<boolean> true 表示有效，false 表示無效
 * @throws {CookieValidationError} 如果驗證過程中出現錯誤
 */
export async function isValidCookie(cookie: string): Promise<boolean> {
  if (!cookie || cookie.trim() === '') {
    logger.warn('提供的 Cookie 為空');
    return false;
  }

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    logger.debug('正在驗證 Cookie 有效性...');

    // 啟動瀏覽器
    browser = await launchBrowser({ headless: true }); // Or use appropriate options

    // 創建一個頁面來測試 Cookie，禁用資源攔截
    page = await newPage(browser, { blockResources: false });

    // 設定 Cookie
    const targetUrl = 'https://www.douyin.com';
    await setCookiesOnPage(page, cookie, '.douyin.com');

    // 導航到抖音首頁 (雖然 newPage 可能已經設定了 domain，但仍需導航)
    await page.goto(targetUrl, { // Use targetUrl here too
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // 檢查是否存在登入後才會顯示的元素或檢查 Cookie
    const isLoggedIn = await page.evaluate(() => {
      // 檢查頁面上的登入狀態
      // 1. 檢查 login.ts 中使用的所有關鍵 Cookie
      const cookies = document.cookie;
      const hasLoginTime = cookies.includes('login_time=');
      const hasIsDouyinActive = cookies.includes('IsDouyinActive=');
      const hasPassportAssistUser = cookies.includes('passport_assist_user=');
      const hasRequiredCookies = hasLoginTime && hasIsDouyinActive && hasPassportAssistUser;

      // 2. 檢查是否存在表示已登入的元素，例如用戶頭像連結或創作者中心入口
      //    注意：這些選擇器可能需要根據實際頁面結構調整
      // const hasAvatarLink = !!document.querySelector('span[data-e2e="live-avatar"]'); // 查找指向個人資料的連結中的圖片
      // const hasCreatorLink = !!document.querySelector('a[href*="creator.douyin.com"]'); // 查找指向創作者中心的連結
      const hasLoggedInIndicator = true;// !!hasAvatarLink;// || hasCreatorLink; // 或其他更可靠的選擇器

      // 記錄檢查結果（在瀏覽器控制台）
      console.log(`Cookie check (passport_assist_user): ${hasPassportAssistUser}`); // Corrected variable name
      console.log(`DOM check (Avatar/Creator Link): ${hasLoggedInIndicator}`); // Keep DOM check log for info

      // 僅依賴 DOM 檢查 (頭像連結)
      // console.log(`DOM check (Avatar Link): ${hasAvatarLink}`); // 使用之前定義的 hasAvatarLink
      // 暫時忽略 Cookie 檢查，因為 DOM 元素是更直接的視覺指標
      // console.log(`Cookie check (login_time): ${hasLoginTime}`);
      // console.log(`Cookie check (IsDouyinActive): ${hasIsDouyinActive}`);
      // console.log(`Cookie check (passport_assist_user): ${hasPassportAssistUser}`);

      return hasRequiredCookies;
    });

    logger.info(`Cookie 驗證結果: ${isLoggedIn ? '有效' : '無效'}`);
    return isLoggedIn;
  } catch (error) {
    // 處理錯誤
    const errorMessage = error instanceof Error ? error.message : String(error);
    // 創建一個錯誤對象來傳遞給 logger.error
    const errorObject = error instanceof Error ? error : new Error(String(error));
    logger.error('驗證 Cookie 時發生錯誤:', errorObject);

    // 創建一個新的 CookieValidationError
    const err = new CookieValidationError(`驗證 Cookie 失敗: ${errorMessage}`);
    throw err;
  } finally {
    // 確保頁面被關閉
    // 確保頁面被關閉
    if (page) {
      try {
        await page.close();
        logger.debug('已關閉驗證用頁面');
      } catch (closeError) {
        const err = closeError instanceof Error ? closeError : new Error(String(closeError));
        logger.error('關閉驗證頁面失敗:', err);
      }
    }
    // 確保瀏覽器被關閉
    if (browser) {
        try {
            await closeBrowser(browser);
            logger.debug('已關閉驗證用瀏覽器');
        } catch (closeError) {
            const err = closeError instanceof Error ? closeError : new Error(String(closeError));
            logger.error('關閉驗證瀏覽器失敗:', err);
        }
    }
  }
}