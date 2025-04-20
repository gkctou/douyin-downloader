/**
 * 抖音影片解析與下載套件
 * 提供對抖音平台視頻的解析和下載功能
 * 
 * @packageDocumentation
 * 
 * @remarks
 * 免責聲明：本套件僅供學習和個人使用。請遵守抖音平台的服務條款和相關法規。
 * 用戶須對使用本套件的行為負責，開發者不對任何濫用行為或因此產生的後果負責。
 * 請尊重原創作者的著作權，不要未經授權分發下載的內容。
 * 
 * 參考來源：此模組改寫自原本存放於 src/ 下的抖音相關功能
 * 但架構已重新組織並與 TikTok 功能相互平行
 * 需要驗證：整體 API 設計是否符合用戶需求和最佳實踐
 */

// ================= 認證與登入模組 (implements AuthService implicitly) =================
// 導出 auth 子模組中的所有功能
export {
  login,
  isValidCookie,
  loadAndValidateCookie,
  getDefaultCookiePath,
  saveCookie,
  loadCookie,
  getAppDataDir // Moved from utils
} from './auth';

// ================= 解析模組 (implements ParserService implicitly) =================
// 導出 parser 子模組中的所有功能
export {
  extractDouyinLinks,
  containsDouyinLink,
  parseDouyinLinks,
  resolveShortUrl
} from './parser';

// ================= 影片資訊模組 (implements InfoService implicitly) =================
// 導出 info 子模組中的所有功能
export {
  fetchVideosInfoText,
  fetchVideosInfoUrls,
  fetchVideoDetail,
  extractSecUserId,
  fetchUserVideos
} from './info';

// ================= 下載模組 (implements DownloadService implicitly) =================
// 導出 download 子模組中的所有功能
export {
  downloadVideo,
  downloadVideos,
  downloadVideosFromText
} from './download';

// ================= 工具函數 (Moved to src/utils) =================
// Removed export block for './utils'