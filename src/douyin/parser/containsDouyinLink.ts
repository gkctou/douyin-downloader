/**
 * 抖音連結檢查模組
 * 檢查文本是否包含抖音連結
 * 
 * @remarks
 * 參考來源：此功能改寫自原本存放於 src/parser/extract-links.ts 的功能
 * 需要驗證：確認函數是否與最新的抖音 URL 格式相容
 */

import { extractDouyinLinks } from './extractDouyinLinks';

/**
 * 檢查文本是否包含抖音連結
 * @param text 要檢查的文本
 * @returns true 如果包含抖音連結，否則 false
 * 
 * @remarks
 * 改寫自原本存放於 src/parser/extract-links.ts 的功能
 * 簡單封裝了 extractDouyinLinks 函數的結果檢查
 */
export function containsDouyinLink(text: string): boolean {
  // 利用 extractDouyinLinks 函數提取連結，檢查是否有結果
  const links = extractDouyinLinks(text);
  return links.length > 0;
} 