// Copied from src/parser/link-patterns.ts
// Original file path: src/parser/link-patterns.ts
/**
 * 抖音連結模式定義
 * 定義各種抖音連結的正則表達式和處理方式
 */

import { parserLogger as logger } from '../../utils/logger'; // Corrected path

/**
 * 連結模式介面
 */
export interface LinkPattern {
  name: string;      // 連結類型名稱
  pattern: RegExp;   // 匹配模式
  needsRedirect: boolean; // 是否需要跟隨重定向
}

/**
 * 抖音連結模式陣列
 * 包含各種可能的抖音連結格式
 */
export const DOUYIN_LINK_PATTERNS: LinkPattern[] = [
  {
    name: 'standard',
    // 標準網頁連結，例如: https://www.douyin.com/video/7123456789
    pattern: /https?:\/\/(?:www\.)?douyin\.com\/video\/(\d+)/,
    needsRedirect: false
  },
  {
    name: 'short',
    // 短連結，例如: https://v.douyin.com/abc123/ 或 https://v.douyin.com/c-mY7xDr-qA/
    pattern: /https?:\/\/v\.douyin\.com\/([a-zA-Z0-9_-]+)\/?/,
    needsRedirect: true
  },
  {
    name: 'mobile',
    // 移動端分享連結，例如: https://www.douyin.com/share/video/123456789
    pattern: /https?:\/\/(?:www\.)?douyin\.com\/share\/video\/(\d+)/,
    needsRedirect: true
  },
  {
    name: 'note',
    // 筆記類型連結，例如: https://www.douyin.com/note/123456789
    pattern: /https?:\/\/(?:www\.)?douyin\.com\/note\/(\d+)/,
    needsRedirect: true
  },
  {
    name: 'discover',
    // 發現頁連結，例如: https://www.douyin.com/discover?modal_id=7123456789
    pattern: /https?:\/\/(?:www\.)?douyin\.com\/discover\?.*modal_id=(\d+)/,
    needsRedirect: true
  },
  {
    name: 'webapp',
    // WebApp 連結，例如: https://www.douyin.com/webapp/7123456789
    pattern: /https?:\/\/(?:www\.)?douyin\.com\/webapp\/(\d+)/,
    needsRedirect: true
  },
  {
    name: 'mobile-param',
    // 帶參數的移動端連結，例如: https://www.iesdouyin.com/share/video/xxx/?region=CN&...
    pattern: /https?:\/\/(?:www\.)?(?:douyin|iesdouyin)\.com\/.*\/.*\?.*(?:video_id|vid)=([^&]+)/,
    needsRedirect: true
  }
];

/**
 * 創建用於在文本中查找所有抖音連結的正則表達式
 * @returns RegExp 可以匹配任何抖音連結的正則表達式
 */
export function createCombinedPattern(): RegExp {
  // 將所有模式的正則表達式合併為一個，使用 | 作為分隔符
  const patternStrings = DOUYIN_LINK_PATTERNS.map(pattern => {
    // 移除 ^ 和 $ 錨點，因為我們要在文本中查找，而不是匹配整個字符串
    return pattern.pattern.source.replace(/^\^|\$$/g, '');
  });

  // 建立一個新的正則表達式，使用 g 標誌進行全局匹配
  const combinedPattern = new RegExp(patternStrings.join('|'), 'g');
  logger.debug(`創建合併正則表達式: ${combinedPattern}`);

  return combinedPattern;
}

/**
 * 獲取抖音連結的類型
 * @param url 抖音連結
 * @returns LinkPattern | null 連結類型或 null (如果不匹配任何類型)
 */
export function getLinkType(url: string): LinkPattern | null {
  for (const pattern of DOUYIN_LINK_PATTERNS) {
    if (pattern.pattern.test(url)) {
      logger.debug(`連結 ${url} 匹配類型: ${pattern.name}`);
      return pattern;
    }
  }

  logger.debug(`連結 ${url} 不匹配任何已知類型`);
  return null;
}

/**
 * 從 URL 中提取影片 ID (如果可能)
 * @param url 抖音連結
 * @returns string | null 影片 ID 或 null (如果無法提取)
 */
export function extractVideoId(url: string): string | null {
  for (const pattern of DOUYIN_LINK_PATTERNS) {
    const match = url.match(pattern.pattern);
    if (match && match[1]) {
      const videoId = match[1];
      logger.debug(`從連結 ${url} 提取到影片 ID: ${videoId}`);
      return videoId;
    }
  }

  // 嘗試從 URL 參數中提取 vid
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get('vid');
    if (videoId) {
      logger.debug(`從連結參數提取到影片 ID: ${videoId}`);
      return videoId;
    }
  } catch (error) {
    logger.debug(`URL 解析失敗: ${error}`);
  }

  logger.debug(`無法從連結 ${url} 提取影片 ID`);
  return null;
}