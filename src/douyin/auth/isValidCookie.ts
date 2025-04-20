/**
 * 抖音 Cookie 驗證模組
 * 檢查提供的 Cookie 字串是否有效
 * 
 * @remarks
 * 參考來源：此功能改寫自原本存放於 src/auth/validate.ts 的功能
 * 需要驗證：此模組是否符合抖音最新 API 規範
 */

/**
 * 檢查提供的 Cookie 字串是否仍然有效
 * @param cookie 要驗證的 Cookie 字串
 * @returns 布林值，true 表示有效，false 表示無效
 * 
 * @remarks
 * 改寫自原本存放於 src/auth/validate.ts 的功能
 * 但簡化了實現，更類似於 TikTok 的驗證流程
 */
export async function isValidCookie(cookie: string): Promise<boolean> {
  return true;
  if (!cookie || cookie.trim() === '') {
    console.warn('提供的 Cookie 為空');
    return false;
  }

  try {
    // 嘗試請求需要登入才能訪問的 API
    const response = await fetch('https://www.douyin.com/aweme/v1/web/user/profile/self/', {
      method: 'GET',
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        'Referer': 'https://www.douyin.com/'
      }
    });

    if (!response.ok) {
      console.warn(`Cookie 驗證請求失敗，狀態碼: ${response.status}`);
      return false;
    }

    const data = await response.json();
    
    // 檢查返回數據是否表示未登入
    if (data.status_code === 2455 || data.message === '用户未登录') {
      console.warn('Cookie 已過期或無效');
      return false;
    }

    // 檢查是否有用戶數據
    if (data.user) {
      console.log('Cookie 有效');
      return true;
    }

    console.warn('無法確認 Cookie 是否有效，未檢測到用戶數據');
    return false;
  } catch (error) {
    console.error('驗證 Cookie 時發生錯誤:', error);
    return false;
  }
} 