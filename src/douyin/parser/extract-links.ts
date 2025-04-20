// Copied from src/parser/extract-links.ts
// Original file path: src/parser/extract-links.ts
/**
 * 連結提取模組
 * 從文本中提取抖音連結
 */

import { parserLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { createCombinedPattern, DOUYIN_LINK_PATTERNS } from './link-patterns';

/**
 * 從文本中提取所有潛在的抖音連結
 * @param text 包含抖音連結的文本
 * @returns string[] 提取出的抖音連結陣列
 */
export function extractDouyinLinks(text: string): string[] {
  if (!text || typeof text !== 'string') {
    logger.warn('提取連結時收到無效文本');
    return [];
  }

  // 使用合併正則表達式提取所有可能的抖音連結
  const combinedPattern = createCombinedPattern();
  const matches = text.match(combinedPattern);

  // 如果沒有找到任何連結，返回空陣列
  if (!matches) {
    logger.debug('文本中未找到抖音連結');
    return [];
  }

  // 過濾重複連結
  const uniqueUrls = Array.from(new Set(matches));
  logger.debug(`從文本中提取到 ${uniqueUrls.length} 個唯一抖音連結`);

  return uniqueUrls;
}

/**
 * 從文本中提取特定類型的抖音連結
 * @param text 包含抖音連結的文本
 * @param typeName 連結類型名稱 (如 'standard', 'short' 等)
 * @returns string[] 提取出的指定類型抖音連結陣列
 */
export function extractDouyinLinksByType(text: string, typeName: string): string[] {
  if (!text || typeof text !== 'string') {
    logger.warn('提取連結時收到無效文本');
    return [];
  }

  // 查找指定類型的模式
  const pattern = DOUYIN_LINK_PATTERNS.find(p => p.name === typeName);
  if (!pattern) {
    logger.warn(`未知的連結類型: ${typeName}`);
    return [];
  }

  // 創建能夠全局匹配的正則表達式
  const globalPattern = new RegExp(pattern.pattern.source, 'g');
  const matches = text.match(globalPattern);

  // 如果沒有找到任何連結，返回空陣列
  if (!matches) {
    logger.debug(`文本中未找到類型為 ${typeName} 的抖音連結`);
    return [];
  }

  // 過濾重複連結
  const uniqueUrls = Array.from(new Set(matches));
  logger.debug(`從文本中提取到 ${uniqueUrls.length} 個類型為 ${typeName} 的唯一抖音連結`);

  return uniqueUrls;
}

/**
 * 檢查文本是否包含抖音連結
 * @param text 要檢查的文本
 * @returns boolean 是否包含抖音連結
 */
export function containsDouyinLink(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const combinedPattern = createCombinedPattern();
  return combinedPattern.test(text);
}