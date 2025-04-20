import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs/promises';

const LOGIN_URL = 'https://www.douyin.com/'; // 抖音首頁，通常會引導登入
const COOKIE_FILE_PATH = 'cookie.login.txt';
const LOGIN_SUCCESS_COOKIE_NAME = 'sessionid'; // 假設 sessionid 是登入成功的標誌

/**
 * 啟動瀏覽器，導航至抖音登入頁面，等待使用者手動登入，
 * 偵測到登入成功後獲取 cookies 並儲存至檔案。
 */
async function loginAndSaveCookie(): Promise<void> {
    let browser: Browser | null = null;
    try {
        console.log('啟動瀏覽器...');
        browser = await puppeteer.launch({
            headless: false, // 顯示瀏覽器界面以便手動登入
            defaultViewport: null, // 使用瀏覽器預設視窗大小
            args: ['--start-maximized'] // 最大化視窗
        });

        const page: Page = await browser.newPage();
        console.log(`導航至 ${LOGIN_URL}...`);
        // 增加超時時間並使用 networkidle0 確保頁面資源加載更完全
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle0', timeout: 600000 });//

        console.log('請在瀏覽器中手動登入抖音...');
        console.log('程式將會等待登入成功後自動抓取 Cookie...');

        // 等待登入成功的標誌 (sessionid cookie)
        console.log(`等待 ${LOGIN_SUCCESS_COOKIE_NAME} cookie 出現...`);
        // 使用 page.waitForResponse 或 page.waitForNavigation 可能更穩定，但 waitForFunction 較通用
        // 增加輪詢頻率檢查 cookie
        await page.waitForFunction(
            (cookieName) => {
                const cookies = document.cookie.split(';').map(c => c.trim());
                return cookies.some(cookie => cookie.startsWith(cookieName + '=') && cookie.split('=')[1].length > 0); // 確保 cookie 有值
            },
            { timeout: 0, polling: 1000 } // 無限期等待，每秒檢查一次
            , LOGIN_SUCCESS_COOKIE_NAME
        );

        console.log('偵測到登入成功！正在獲取 cookies...');
        // 稍微等待一下，確保所有登入相關的 cookie 都已設定
        await new Promise(resolve => setTimeout(resolve, 2000));
        const cookies = await page.cookies();
        console.log(`獲取到 ${cookies.length} 個 cookies。`);

        // 將 cookies 格式化為字串 (JSON 格式)
        const cookieString = JSON.stringify(cookies, null, 2);

        console.log(`正在將 cookies 寫入 ${COOKIE_FILE_PATH}...`);
        await fs.writeFile(COOKIE_FILE_PATH, cookieString);
        console.log(`Cookies 已成功儲存至 ${COOKIE_FILE_PATH}`);
        console.log('您可以關閉此程式或瀏覽器視窗了。');

    } catch (error) {
        console.error('執行過程中發生錯誤:', error);
    } finally {
        if (browser) {
            console.log('關閉瀏覽器...');
            // 等待使用者確認或一段時間後再關閉，避免立即關閉讓使用者措手不及
            // 這裡選擇不自動關閉，讓使用者手動關閉，因為登入過程可能需要時間
            await browser.close();
            // console.log('瀏覽器保持開啟狀態，請手動關閉。');
        }
    }
}

// 執行主函數
loginAndSaveCookie();