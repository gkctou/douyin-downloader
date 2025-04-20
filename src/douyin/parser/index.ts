// Copied from src/parser/index.ts
// Original file path: src/parser/index.ts
/**
 * 連結解析模組
 * 提供解析抖音各種格式連結的功能
 */

import { parserLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { ParseResult, ParseOptions } from '../../types'; // Adjusted import path
import { extractDouyinLinks, containsDouyinLink } from './extract-links';
import { resolveLink, resolveShortUrl, createStandardUrl } from './resolve-links';
import { parseBatch, parseBatchWithStats } from './parse-batch';
import { getLinkType, extractVideoId } from './link-patterns';
// 重新導出所有公開函數
export {
  extractDouyinLinks,
  containsDouyinLink,
  resolveLink,
  resolveShortUrl,
  parseBatch,
  parseBatchWithStats,
  getLinkType,
  extractVideoId,
  createStandardUrl
};

/**
 * 將單個抖音連結標準化
 * @param url 抖音連結
 * @returns Promise<ParseResult | null> 解析結果或 null
 */
export async function standardizeDouyinUrl(url: string): Promise<ParseResult | null> {
  return await resolveLink(url);
}

/**
 * 解析抖音短連結並獲取標準 URL
 * @param shortUrl 抖音短連結
 * @returns Promise<string | null> 標準抖音影片 URL 或 null
 */
export async function parseDouyinShortUrl(shortUrl: string): Promise<string | null> {
  return await resolveShortUrl(shortUrl);
}

/**
 * 從文本中提取抖音連結
 * @param text 包含抖音連結的文本
 * @returns string[] 提取出的抖音連結陣列
 */
export function extractDouyinUrls(text: string): string[] {
  return extractDouyinLinks(text);
}

/**
 * 從文本中解析抖音連結，支援多種格式（標準URL、短連結、移動端分享連結等），並將其標準化。
 * @param text 包含一個或多個抖音連結的文本字串
 * @param options 解析選項
 * @returns Promise<ParseResult[]> 解析結果陣列
 */
export async function parseDouyinLinks(
  text: string,
  options: ParseOptions = {}
): Promise<ParseResult[]> {
  // 提取連結
  const urls = extractDouyinLinks(text);
  logger.info(`從文本中找到 ${urls.length} 個抖音連結`);

  if (urls.length === 0) {
    logger.warn('未找到任何抖音連結');
    return [];
  }

  // 並行解析所有連結
  const results = await parseBatch(urls, options);

  return results;
}