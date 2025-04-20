/**
 * 抖音登入與Cookie管理範例
 */

import { login, isValidCookie, saveCookie, loadCookie, LoginResult } from '../src/douyin/auth';
import path from 'path';
import { infoLogger, LogLevel } from '../src/utils/logger'; // Updated path to shared utils

// 設置日誌級別
infoLogger.setLevel(LogLevel.DEBUG);

/**
 * 抖音登入範例，開啟瀏覽器讓用戶手動登入
 */
async function loginExample() {
  try {
    console.log('開始抖音登入流程...');

    // 呼叫登入函數，開啟瀏覽器並等待用戶登入
    // 設置 autoCleanup: false 保持瀏覽器開啟，直到手動關閉
    const result = await login(undefined, {
      autoCleanup: false // 不自動清理瀏覽器資源，讓用戶可以看到登入成功後的頁面
    }) as LoginResult; // 強制轉換為 LoginResult 類型

    console.log('登入成功，獲取到Cookie');

    // 保存Cookie到預設位置
    await saveCookie(result.cookie, path.resolve(__dirname, 'cookie.txt'));
    console.log('Cookie已保存到預設位置');

    // 提示用戶可以查看瀏覽器
    console.log('您可以查看登入後的瀏覽器頁面。按下 Enter 鍵關閉瀏覽器...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    // 手動清理瀏覽器資源
    await result.cleanup();
    console.log('已關閉瀏覽器');

    return result.cookie;
  } catch (error) {
    console.error('登入失敗:', error);
    return null;
  }
}

/**
 * 驗證Cookie有效性範例
 */
async function validateCookieExample(cookieString?: string) {
  try {
    // 如果沒有提供Cookie，嘗試從預設位置載入
    if (!cookieString) {
      console.log('嘗試從預設位置載入Cookie...');
      cookieString = await loadCookie();
      if (!cookieString) {
        console.error('未找到Cookie，請先登入');
        return false;
      }
    }

    console.log('正在驗證Cookie有效性...');
    const isValid = await isValidCookie(cookieString);

    if (isValid) {
      console.log('Cookie有效，可以繼續使用');
    } else {
      console.log('Cookie已失效，需要重新登入');
    }

    return isValid;
  } catch (error) {
    console.error('驗證Cookie時出錯:', error);
    return false;
  }
}

/**
 * 自定義Cookie路徑範例
 */
async function customCookiePathExample() {
  try {
    // 自定義Cookie路徑
    const customPath = path.join(__dirname, 'my-custom-cookie.txt');

    console.log(`開始登入並將Cookie保存到自定義路徑: ${customPath}`);
    const result = await login(customPath, {
      autoCleanup: false // 不自動清理瀏覽器資源
    }) as LoginResult;

    if (result) {
      console.log(`Cookie已保存到自定義路徑: ${customPath}`);

      // 從自定義路徑載入
      const loadedCookie = await loadCookie(customPath);
      console.log('成功從自定義路徑載入Cookie');

      // 驗證載入的Cookie
      await validateCookieExample(loadedCookie);

      // 提示用戶可以查看瀏覽器
      console.log('您可以查看登入後的瀏覽器頁面。按下 Enter 鍵關閉瀏覽器...');
      await new Promise(resolve => {
        process.stdin.once('data', resolve);
      });

      // 手動清理瀏覽器資源
      await result.cleanup();
      console.log('已關閉瀏覽器');
    }
  } catch (error) {
    console.error('自定義Cookie路徑操作失敗:', error);
  }
}

// 主函數：依次執行各個範例
async function main() {
  console.log('===== 抖音登入範例 =====');
  // 註釋掉以避免每次執行都開啟瀏覽器
  const cookie = await loginExample();

  console.log('\n===== 驗證Cookie有效性範例 =====');
  // await validateCookieExample(path.resolve(__dirname, 'cookie.txt'));

  console.log('\n===== 自定義Cookie路徑範例 =====');
  // 註釋掉以避免每次執行都開啟瀏覽器
  // await customCookiePathExample();

  console.log('\n所有範例執行完畢');
}

// 如果直接執行此檔案，則運行主函數
if (require.main === module) {
  main().catch(console.error);
}
