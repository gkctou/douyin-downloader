// Copied from src/parser/resolve-links.ts
// Original file path: src/parser/resolve-links.ts
/**
 * 連結解析與標準化模組
 * 解析抖音連結並將其標準化
 */

import { parserLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { enhancedFetch } from '../../utils/fetch'; // Updated path to shared utils
import { withRetry } from '../../utils/retry'; // Updated path to shared utils
import { ParseResult, ParseOptions } from '../../types'; // Adjusted import path
import { getLinkType, extractVideoId } from './link-patterns';

/**
 * 標準化抖音影片 URL
 * @param videoId 影片 ID
 * @returns 標準化後的抖音影片 URL
 */
export function createStandardUrl(videoId: string): string {
  return `https://www.douyin.com/video/${videoId}`;
}

/**
 * 解析抖音短連結並獲取標準 URL
 * @param shortUrl 抖音短連結
 * @param options 解析選項
 * @returns Promise<string | null> 標準抖音影片 URL 或 null
 */
export async function resolveShortUrl(
  shortUrl: string,
  options: Pick<ParseOptions, 'userAgent' | 'retries'> = {}
): Promise<string | null> {
  const { userAgent, retries = 3 } = options;

  try {
    logger.debug(`解析短連結: ${shortUrl}`);

    // 使用 withRetry 包裝請求，以便在失敗時自動重試
    const finalUrl = await withRetry(async () => {
      const response = await enhancedFetch(shortUrl, {
        redirect: 'follow', // 自動跟隨重定向
        headers: {
          'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        }
      });
      return response.url; // 返回最終 URL
    }, { retries });

    logger.debug(`解析後的最終 URL: ${finalUrl}`);

    // 嘗試從最終 URL 中提取影片 ID
    const videoId = extractVideoId(finalUrl);
    if (videoId) {
      const standardUrl = createStandardUrl(videoId);
      logger.debug(`已提取標準 URL: ${standardUrl}`);
      return standardUrl;
    }
    if (finalUrl.startsWith('https://www.iesdouyin.com/share/video/')) {
      const response = await enhancedFetch(shortUrl, {
        redirect: 'follow', // 自動跟隨重定向
        headers: {
          'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        }
      });
      return response.url;
    }
    logger.warn(`無法從 URL (${finalUrl}) 提取影片 ID`);
    return null;
  } catch (error) {
    logger.error(`解析短連結 ${shortUrl} 失敗:`, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * 解析單個抖音連結
 * @param url 抖音連結
 * @param options 解析選項
 * @returns Promise<ParseResult | null> 解析結果或 null
 */
export async function resolveLink(
  url: string,
  options: Pick<ParseOptions, 'userAgent' | 'retries'> = {}
): Promise<ParseResult | null> {
  try {
    // 獲取連結類型
    const linkType = getLinkType(url);

    // 如果連結類型未知，則返回 null
    if (!linkType) {
      logger.warn(`未知的連結類型: ${url}`);
      return null;
    }

    // 處理不同類型的連結
    if (linkType.needsRedirect) {
      // 需要跟隨重定向的連結
      const standardUrl = await resolveShortUrl(url, options);
      if (!standardUrl) {
        return null;
      }

      // 從標準 URL 提取影片 ID
      const videoId = extractVideoId(standardUrl);
      if (!videoId) {
        return null;
      }

      // Determine link type from the resolved standard URL
      const finalLinkType = getLinkType(standardUrl);
      logger.debug(`標準化連結 (重定向後): ${standardUrl} (類型: ${finalLinkType?.name || 'unknown'})`); // Use name property

      return {
        id: videoId,
        standardUrl,
        originalUrl: url,
        type: finalLinkType?.name === 'standard' ? 'video' : (finalLinkType?.name ? 'unknown' : 'unknown') // Map name to ParseResult type
        // TODO: Need a better mapping if user links are introduced
      };
    } else {
      // 已經是標準連結，直接提取影片 ID
      const videoId = extractVideoId(url);
      if (!videoId) {
        return null;
      }

      const standardUrl = createStandardUrl(videoId);
      // Determine link type from the standard URL
      const finalLinkType = getLinkType(standardUrl);
      logger.debug(`標準化連結 (直接): ${standardUrl} (類型: ${finalLinkType?.name || 'unknown'})`); // Use name property

      return {
        id: videoId,
        standardUrl,
        originalUrl: url,
        type: finalLinkType?.name === 'standard' ? 'video' : (finalLinkType?.name ? 'unknown' : 'unknown') // Map name to ParseResult type
        // TODO: Need a better mapping if user links are introduced
      };
    }
  } catch (error) {
    logger.error(`解析連結 ${url} 失敗:`, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}