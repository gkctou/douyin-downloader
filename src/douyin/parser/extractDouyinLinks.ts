/**
 * 抖音連結提取模組
 * 從文本中提取抖音連結
 * 
 * @remarks
 * 參考來源：此功能改寫自原本存放於 src/parser/extract-links.ts 的功能
 * 需要驗證：正則表達式是否匹配最新的抖音 URL 格式
 */

/**
 * 抖音 URL 正則表達式模式
 */
const PATTERNS = [
  // 標準網頁連結，例如: https://www.douyin.com/video/7123456789
  /https?:\/\/(?:www\.)?douyin\.com\/video\/(\d+)/g,
  
  // 短連結，例如: https://v.douyin.com/abc123/
  /https?:\/\/v\.douyin\.com\/([a-zA-Z0-9-]+)\/?/g,
  
  // 移動端分享連結，例如: https://www.douyin.com/share/video/123456789
  /https?:\/\/(?:www\.)?douyin\.com\/share\/video\/(\d+)/g,
  
  // 筆記類型連結，例如: https://www.douyin.com/note/123456789
  /https?:\/\/(?:www\.)?douyin\.com\/note\/(\d+)/g,
  
  // 發現頁連結，例如: https://www.douyin.com/discover?modal_id=7123456789
  /https?:\/\/(?:www\.)?douyin\.com\/discover\?.*modal_id=(\d+)/g,
  
  // 帶參數的移動端連結，例如: https://www.iesdouyin.com/share/video/xxx/?region=CN&...
  /https?:\/\/(?:www\.)?(?:douyin|iesdouyin)\.com\/.*\/.*\?.*(?:video_id|vid)=([^&]+)/g
  //  https://www.douyin.com/?vid=7489881436611218751&recommend=1
  // /https?:\/\/(?:www\.)?douyin\.com\/\?.*vid=(\d+)/g,
];

/**
 * 從文本中提取抖音連結
 * @param text 可能包含抖音連結的文本
 * @returns 提取出的抖音連結陣列
 * 
 * @remarks
 * 改寫自原本存放於 src/parser/extract-links.ts 的功能
 * 使用正則表達式匹配不同的抖音網址格式
 */
export function extractDouyinLinks(text: string): string[] {
  if (!text) return [];
  
  // 使用所有模式匹配文本
  const results: string[] = [];
  for (const pattern of PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        // 避免重複添加
        if (!results.includes(match)) {
          results.push(match);
        }
      }
    }
  }
  
  return results;
} 