// Copied from src/info/user.ts
// Original file path: src/info/user.ts
/**
 * 用戶影片獲取模組
 * 提供獲取抖音用戶發布影片列表的功能
 */

import { infoLogger as logger } from '../../utils/logger';
import { getJson } from '../../utils/fetch'; // Import the general fetch utility
import { UserVideoItem, UserVideosOptions } from '../../types';
import { fetchWithRetry, handleDouyinApiError } from './error-handler'; // Assuming this path is correct relative to the new location

/**
 * 抖音 API 專用的 GET 請求函數
 * @param url API URL
 * @param params 查詢參數
 * @param options 請求選項
 * @returns Promise<any> API 響應
 */
async function douyinApiGet<T = any>(url: string, params: Record<string, any> = {}, options = {}): Promise<T> {
  // 構建完整的 URL，包含查詢參數
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
  
  // 使用通用的 getJson 函數發送請求
  return await getJson<T>(fullUrl, options);
}

// Define a more specific type for items in aweme_list
interface AwemeItem {
  aweme_id: string;
  desc: string;
  create_time: number;
  video?: {
    play_addr?: {
      url_list?: string[];
    };
  };
  author?: {
    sec_uid?: string;
    uid?: string; // Include uid as a fallback
    nickname?: string;
  };
  statistics?: {
    play_count?: number;
    digg_count?: number; // Likes
    comment_count?: number;
    share_count?: number;
  };
}

/**
 * 從 URL 列表中獲取官方影片下載地址
 * @param urlList URL 列表
 * @returns 官方影片下載地址
 */
export function getOfficialVideoUrl(urlList: string[] | undefined): string {
  if (!urlList || urlList.length === 0) return '';

  // API返回的url_list通常包含多個URL，其中包含官方下載地址
  // 檢查每個URL，返回官方格式的鏈接
  for (const url of urlList) {
    if (url.includes('douyin.com/aweme/v1/play')) {
      return url;
    }
  }

  // 如果沒有找到官方鏈接，則返回第一個鏈接作為後備
  return urlList[0];
}

// 抖音用戶作品 API
const USER_POST_API = 'https://www.douyin.com/aweme/v1/web/aweme/post/';
// 抖音用戶喜歡作品 API
const USER_FAVORITE_API = 'https://www.douyin.com/aweme/v1/web/aweme/favorite/';

/**
 * 從 URL 中提取用戶 ID (sec_uid)
 * @param userUrl 用戶主頁 URL
 * @returns 用戶 ID 或 null
 */
export function extractSecUserId(userUrl: string): string | null {
  try {
    // 嘗試從 URL 參數中提取
    const urlObj = new URL(userUrl);
    // Correct parameter name: sec_user_id instead of sec_uid
    const secUid = urlObj.searchParams.get('sec_user_id');
    // Removed temporary debug log
    if (secUid) {
      return secUid;
    }

    // 嘗試從路徑中提取
    const pathMatch = userUrl.match(/\/user\/([^?/]+)/);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1];
    }

    logger.warn(`無法從 URL 中提取用戶 ID: ${userUrl}`);
    return null;
  } catch (error) {
    // Ensure the caught error is treated as an Error object for the logger
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`解析用戶 URL 失敗: ${userUrl}`, error instanceof Error ? error : new Error(errorMsg));
    return null;
  }
}

/**
 * 獲取用戶影片分頁數據
 * @param apiUrl API URL
 * @param secUserId 用戶 ID
 * @param cursor 分頁游標
 * @param cookie Cookie 字串
 * @returns Promise<{videos: UserVideoItem[], nextCursor: number, hasMore: boolean}>
 */
async function fetchUserVideoPage(
  apiUrl: string,
  secUserId: string,
  cursor: number,
  cookie: string
): Promise<{videos: UserVideoItem[], nextCursor: number, hasMore: boolean, total?: number}> {
  // 構建請求參數
  const params = {
    sec_user_id: secUserId,
    count: 20, // 每頁數量
    max_cursor: cursor,
    aid: '6383',
    version_code: '170400',
    device_platform: 'webapp',
    cookie_enabled: 'true'
  };

  // 帶 Cookie 的請求頭
  const headers = {
    'Cookie': cookie,
    'Referer': apiUrl.includes('favorite')
      ? `https://www.douyin.com/user/${secUserId}?showTab=like`
      : `https://www.douyin.com/user/${secUserId}`
  };

  // 使用重試機制發送請求
  return await fetchWithRetry(async () => {
    try {
      const response = await douyinApiGet(apiUrl, params, { headers });

      // 檢查響應格式
      if (!response.aweme_list || !Array.isArray(response.aweme_list)) {
        throw new Error('獲取用戶影片列表失敗，響應數據格式異常');
      }

      // 檢查是否有錯誤信息
      if (response.status_code && response.status_code !== 0) {
        throw new Error(`獲取用戶影片失敗，狀態碼: ${response.status_code}, 信息: ${response.status_msg || '未知錯誤'}`);
      }

      // Use the defined AwemeItem type here
      const videos: UserVideoItem[] = response.aweme_list.map((item: AwemeItem): UserVideoItem => {
          const urlList = item.video?.play_addr?.url_list;
          const videoPlayUrl = getOfficialVideoUrl(urlList); // Use helper to get a playable URL

          return {
              vid: item.aweme_id,
              description: item.desc,
              createTime: item.create_time,
              videoPlayUrl: videoPlayUrl, // Assign the determined play URL
              author: {
                  id: item.author?.sec_uid || item.author?.uid || '',
                  nickname: item.author?.nickname || '未知作者',
              },
              stats: {
                  playCount: item.statistics?.play_count,
                  likeCount: item.statistics?.digg_count, // digg_count 是點讚數
                  commentCount: item.statistics?.comment_count,
                  shareCount: item.statistics?.share_count,
              },
          };
      });

      return {
        videos,
        nextCursor: response.max_cursor,
        hasMore: response.has_more === 1,
        total: response.total
      };

    } catch (error: unknown) {
      // ... (error handling remains the same)
      let statusCode: number | undefined;
      let message: string | undefined;

      if (typeof error === 'object' && error !== null) {
        if ('response' in error && typeof (error as any).response === 'object' && (error as any).response !== null && 'status' in (error as any).response) {
          statusCode = (error as any).response.status;
        }
        if ('message' in error && typeof (error as any).message === 'string') {
          message = (error as any).message;
        }
      }

      if (statusCode === 403 || (message && message.includes('403'))) {
        logger.warn('無效的 Cookie 或權限不足，返回空列表');
        return { videos: [], nextCursor: 0, hasMore: false };
      }
      throw error;
    }
  });
}

/**
 * 獲取指定用戶的影片列表
 * @param userUrl 用戶主頁 URL
 * @param cookie 有效的抖音 Cookie
 * @param limit 限制獲取的影片數量，0 表示獲取全部
 * @param options 獲取選項
 * @returns Promise<UserVideoItem[]> 用戶影片列表
 */
export async function fetchUserVideos(
  userUrl: string,
  cookie: string,
  limit = 0,
  options: UserVideosOptions = {}
): Promise<UserVideoItem[]> {
  // 確認 Cookie 是否提供
  if (!cookie || cookie.trim() === '') {
    logger.error('未提供有效的 Cookie，無法獲取用戶影片');
    throw new Error('需要有效的抖音 Cookie 才能獲取用戶影片');
  }

  // 提取用戶 ID
  const secUserId = extractSecUserId(userUrl);
  if (!secUserId) {
    throw new Error(`無法從 URL 提取用戶 ID: ${userUrl}`);
  }

  logger.info(`開始獲取用戶 (${secUserId}) 的影片列表`);

  // 確定是獲取用戶發布的影片還是喜歡的影片
  const isLikedVideos = userUrl.includes('/user') && userUrl.includes('showTab=like');
  const apiUrl = isLikedVideos ? USER_FAVORITE_API : USER_POST_API;

  // 初始化結果和游標
  const results: UserVideoItem[] = [];
  let cursor = 0;
  let hasMore = true;
  let totalEstimated: number | undefined;

  try {
    // 分頁獲取數據
    while (hasMore && (limit === 0 || results.length < limit)) {
      logger.debug(`獲取用戶影片列表頁，當前游標: ${cursor}`);

      // 獲取單頁數據
      const { videos, nextCursor, hasMore: hasMoreData, total } = await fetchUserVideoPage(
        apiUrl,
        secUserId,
        cursor,
        cookie
      );

      // 如果獲取到了總數，更新估計總數
      if (total !== undefined) {
        totalEstimated = total;
      }

      // 添加到結果中
      results.push(...videos);

      // 更新進度
      if (options.onProgress) {
        options.onProgress(results.length, totalEstimated);
      }

      // 更新游標和是否還有更多
      cursor = nextCursor;
      hasMore = hasMoreData;

      // 如果已達到限制，截斷結果
      if (limit > 0 && results.length >= limit) {
        results.splice(limit);
        break;
      }

      // 如果沒有更多數據，結束循環
      if (!hasMore) {
        break;
      }

      // 短暫延遲防止請求過於頻繁
      await new Promise(resolve => setTimeout(resolve, 500));

      logger.debug(`已獲取 ${results.length} 個影片${totalEstimated ? `，總計約 ${totalEstimated} 個` : ''}`);
    }

    logger.info(`成功獲取用戶 (${secUserId}) 的影片列表，共 ${results.length} 個`);
    return results;
  } catch (error) {
    // 使用自定義錯誤處理函數
    const enhancedError = handleDouyinApiError(error);
    logger.error(`獲取用戶影片列表失敗: ${enhancedError.message}`);
    throw enhancedError;
  }
}