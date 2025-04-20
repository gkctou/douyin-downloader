/**
 * 抖音連結解析模組
 * 從文本中解析抖音連結，支援多種格式並將其標準化
 * 
 * @remarks
 * 參考來源：此功能改寫自原本存放於 src/parser/resolve-links.ts 和 src/parser/parse-batch.ts 的功能
 * 需要驗證：URL 處理邏輯是否與最新抖音 API 兼容
 */

import { ParseResult, ParseOptions } from '../../types';
import { extractDouyinLinks } from './extractDouyinLinks';

/**
 * 從文本中解析抖音連結，支援多種格式（標準URL、短連結、移動端分享連結等），並將其標準化
 * @param text 包含一個或多個抖音連結的文本字串
 * @param options 解析選項
 * @returns 解析結果陣列
 * 
 * @remarks
 * 改寫自原本存放於 src/parser/index.ts 的 parseDouyinLinks 功能
 * 但實現方式不同，此處使用了批量處理和並發控制
 */
export async function parseDouyinLinks(
  text: string,
  options: ParseOptions = {}
): Promise<ParseResult[]> {
  // 提取所有抖音連結
  const links = extractDouyinLinks(text);
  if (links.length === 0) {
    return [];
  }

  const { concurrency = 3, onProgress } = options;
  const results: ParseResult[] = [];
  const total = links.length;
  let processed = 0;

  // 分批處理連結，避免同時發送過多請求
  for (let i = 0; i < links.length; i += concurrency) {
    const batch = links.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (link) => {
        try {
          return await resolveAndStandardizeDouyinLink(link);
        } catch (error) {
          console.error(`解析連結失敗: ${link}`, error);
          return null;
        } finally {
          processed++;
          if (onProgress) {
            onProgress(processed, total);
          }
        }
      })
    );

    // 過濾掉 null 結果並添加到結果集
    results.push(...batchResults.filter((r): r is ParseResult => r !== null));
  }

  return results;
}

/**
 * 解析並標準化抖音連結
 * @param url 抖音連結
 * @returns 標準化後的解析結果
 * 
 * @remarks
 * 改寫自原本存放於 src/parser/resolve-links.ts 的功能
 * 處理不同格式的抖音 URL 並解析 video ID
 */
export async function resolveAndStandardizeDouyinLink(url: string): Promise<ParseResult | null> {
  try {
    // 處理短連結
    let expandedUrl = url;
    if (url.includes('v.douyin.com') || url.includes('iesdouyin.com')) {
      const resolvedUrl = await expandShortUrl(url);
      // 如果展開成功，使用展開後的 URL
      if (resolvedUrl) {
        expandedUrl = resolvedUrl;
      }
    }

    // 提取影片 ID
    const id = extractVideoId(expandedUrl);
    if (!id) {
      console.warn(`無法從連結提取影片 ID: ${url}`);
      return null;
    }

    // 創建標準 URL
    const standardUrl = createStandardUrl(id);

    return {
      id,
      standardUrl,
      originalUrl: url,
      type: 'video'
    };
  } catch (error) {
    console.error(`標準化連結失敗: ${url}`, error);
    return null;
  }
}

/**
 * 展開抖音短連結
 * @param shortUrl 抖音短連結
 * @returns 展開後的完整 URL
 * 
 * @remarks
 * 改寫自原本存放於 src/parser/resolve-links.ts 的功能
 * 處理抖音短網址重定向
 */
async function expandShortUrl(shortUrl: string): Promise<string | null> {
  try {
    const response = await fetch(shortUrl, { method: 'HEAD', redirect: 'follow' });
    return response.url || null;
  } catch (error) {
    console.error(`展開短連結失敗: ${shortUrl}`, error);
    return null;
  }
}

/**
 * 從抖音 URL 中提取影片 ID
 * @param url 抖音 URL
 * @returns 影片 ID
 * 
 * @remarks
 * 改寫自原本存放於 src/parser/link-patterns.ts 的功能
 */
function extractVideoId(url: string): string | null {
  // 標準網頁 URL
  const videoIdMatch = url.match(/douyin\.com\/video\/(\d+)/i);
  if (videoIdMatch && videoIdMatch[1]) {
    return videoIdMatch[1];
  }

  // 筆記連結
  const noteMatch = url.match(/douyin\.com\/note\/(\d+)/i);
  if (noteMatch && noteMatch[1]) {
    return noteMatch[1];
  }

  // 分享連結
  const shareMatch = url.match(/douyin\.com\/share\/video\/(\d+)/i);
  if (shareMatch && shareMatch[1]) {
    return shareMatch[1];
  }

  // 嘗試從 URL 參數中提取
  try {
    const url_obj = new URL(url);
    const videoId = url_obj.searchParams.get('video_id') || url_obj.searchParams.get('vid');
    if (videoId) {
      return videoId;
    }
  } catch (e) {
    // URL 解析失敗，忽略錯誤
  }

  return null;
}

/**
 * 根據影片 ID 創建標準抖音 URL
 * @param id 影片 ID
 * @returns 標準抖音 URL
 * 
 * @remarks
 * 改寫自原本存放於 src/parser/resolve-links.ts 的功能
 */
function createStandardUrl(id: string): string {
  return `https://www.douyin.com/video/${id}`;
} 