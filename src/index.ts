/**
 * 抖音影片解析與下載套件
 * 
 * @packageDocumentation
 * 
 * @remarks
 * 免責聲明：本套件僅供學習和個人使用。請遵守抖音平台的服務條款和相關法規。
 * 用戶須對使用本套件的行為負責，開發者不對任何濫用行為或因此產生的後果負責。
 * 請尊重原創作者的著作權，不要未經授權分發下載的內容。
 */

// 導出類型定義
export * from './types';

// 導出錯誤處理
export { AppError, ErrorCode } from './utils/error'; // Export the actual error class and enum

export * as douyin from './douyin';

// ======================== 通用工具 ========================

// 導出日誌和性能工具
export {
  Logger,
  LogLevel
} from './utils/logger'; // Corrected path

export {
  PerformanceMonitor,
  timeAsync,
  time
} from './utils/performance'; // Corrected path

// 導出瀏覽器管理工具
export { browserManager, cleanupBrowser } from './utils/browser'; // Corrected path

// 導出其他通用工具 (如果有的話)
// export * from './utils/index'; // Example if utils/index.ts exports common utilities
