// src/types.ts

// --- Common Options ---

/**
 * 基礎選項接口，包含通用配置如並行數、重試次數、超時和進度回調
 */
export interface BaseOptions {
  /** 並行處理請求的數量 */
  concurrency?: number;
  /** 網路請求失敗時的重試次數 */
  retries?: number;
  /** 請求超時時間（毫秒） */
  timeout?: number;
  /**
   * 進度回調函數
   * @param current 當前處理的項目數
   * @param total 總項目數
   * @param overallProgress 可選的總體進度百分比 (0-100)
   */
  onProgress?: (current: number, total: number, overallProgress?: number) => void;
}

/**
 * 登入選項
 */
export interface LoginOptions extends BaseOptions {
  /** Cookie 檔案的儲存路徑 */
  cookiePath?: string;
  /** 是否在登入成功或失敗後自動清理瀏覽器資源 */
  autoCleanup?: boolean;
}

/**
 * 連結解析選項
 */
export interface ParseOptions extends BaseOptions {
  /** 自訂請求時使用的 User-Agent */
  userAgent?: string;
}

/**
 * 影片資訊獲取選項
 */
export interface FetchVideoOptions extends BaseOptions {}

/**
 * 用戶影片獲取選項
 */
export interface UserVideosOptions extends BaseOptions {
  /** 限制獲取的影片數量，0 表示獲取全部 */
  limit?: number;
  /** 用於分頁的游標 (平台特定) */
  cursor?: string | number;
  /**
   * 進度回調函數 (特定於用戶影片獲取)
   * @param fetchedCount 已獲取的影片數量
   * @param totalEstimated 預估的總影片數量 (如果可用)
   */
  onProgress?: (fetchedCount: number, totalEstimated?: number) => void;
}

/**
 * 影片下載選項
 */
export interface DownloadOptions extends BaseOptions {
  /** 是否覆蓋已存在的檔案，預設 false */
  overwrite?: boolean;
  /** 是否按用戶名創建子文件夾，預設 true */
  useSubfolders?: boolean;
  /** 檔名模板，預設 "{date}-{title}" */
  filenameTemplate?: string;
  /**
   * 單個文件下載進度回調函數
   * @param progress 當前文件的下載進度百分比 (0-100)
   */
  onFileProgress?: (progress: number) => void;
  /** 自定義請求頭 */
  headers?: Record<string, string>;
  // BaseOptions.onProgress can be used for overall batch progress
}


// --- Common Results ---

/**
 * 登入結果
 */
export interface LoginResult {
  /** 獲取到的 Cookie 字串 */
  cookie: string;
  /** 用於清理登入過程中創建的資源（如瀏覽器實例）的函數 */
  cleanup: () => Promise<void>;
}

/**
 * 連結解析結果
 */
export interface ParseResult {
  /** 在原始文本中找到的URL */
  originalUrl: string;
  /** 標準化後的影片或用戶主頁 URL */
  standardUrl: string;
  /** 提取到的 ID (影片 ID 或用戶 ID) */
  id: string;
  /** 連結類型 */
  type: 'video' | 'user' | 'unknown';
}

/**
 * 通用影片資訊結構
 */
export interface VideoInfo {
  /** 平台特定的影片 ID */
  id: string;
  /** 影片標題 */
  title: string;
  /** 影片描述 */
  description?: string;
  /** 用於播放或下載的影片 URL */
  videoPlayUrl: string;
  cdnPlayUrls: string[];
  /** 影片封面圖片 URL */
  coverUrl?: string;
  /** 作者暱稱 */
  userName: string;
  /** 作者主頁 URL */
  userUrl: string;
  /** 平台特定的作者 ID */
  userId?: string;
  /** 影片發布日期 (建議 ISO 8601 格式) */
  releaseDate?: string;
  /** 影片時長 (秒) */
  duration?: number;
  /** 影片統計數據 */
  stats?: {
    playCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
  };
}

/**
 * 通用用戶影片列表項結構
 */
export interface UserVideoItem {
  /** 平台特定的影片 ID */
  vid: string;
  /** 影片描述/標題 */
  description: string;
  /** 影片創建時間戳 (秒) */
  createTime: number;
  /** 可選的影片播放/下載 URL */
  videoPlayUrl?: string;
  /** 作者資訊 */
  author: {
    /** 平台特定的作者 ID */
    id: string;
    /** 作者暱稱 */
    nickname: string;
  };
  /** 影片統計數據 */
  stats?: {
    playCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
  };
}

/**
 * 下載結果
 */
export interface DownloadResult {
  /** 原始影片資訊 */
  videoInfo: VideoInfo; // 使用通用的 VideoInfo
  /** 是否下載成功 */
  success: boolean;
  /** 下載成功時的檔案路徑 */
  filePath?: string;
  /** 下載失敗時的錯誤資訊 */
  error?: Error;
}


// --- Service Interfaces ---

/**
 * 認證服務介面
 */
export interface AuthService {
  login(options?: LoginOptions): Promise<LoginResult>;
  isValidCookie(cookie: string): Promise<boolean>;
  loadCookie(cookiePath?: string): Promise<string | null>;
  saveCookie(cookie: string, cookiePath?: string): Promise<void>;
  loadAndValidateCookie(cookiePath?: string): Promise<string | null>;
  getDefaultCookiePath(): string;
}

/**
 * 資訊獲取服務介面
 */
export interface InfoService {
  fetchVideoDetail(url: string, cookie: string, options?: FetchVideoOptions): Promise<VideoInfo | null>;
  fetchVideosInfoUrls(urls: string[], cookie: string, options?: FetchVideoOptions): Promise<VideoInfo[]>;
  fetchVideosInfoText(text: string, cookie: string, options?: FetchVideoOptions): Promise<VideoInfo[]>;
  fetchUserVideos(userUrl: string, cookie: string, limit?: number, options?: UserVideosOptions): Promise<UserVideoItem[]>;
}

/**
 * 下載服務介面
 */
export interface DownloadService {
  downloadVideo(videoInfo: VideoInfo, outputPath: string, options?: DownloadOptions): Promise<DownloadResult>;
  downloadVideos(videoInfos: VideoInfo[], outputPath: string, options?: DownloadOptions): Promise<DownloadResult[]>;
  downloadVideosFromUrls(videoUrls: string[], outputPath: string, cookie: string, options?: DownloadOptions): Promise<DownloadResult[]>;
  downloadVideosFromText(text: string, outputPath: string, cookie: string, options?: DownloadOptions): Promise<DownloadResult[]>;
}

/**
 * 解析器服務介面
 */
export interface ParserService {
  extractLinks(text: string): string[];
  parseLinks(urls: string[], options?: ParseOptions): Promise<ParseResult[]>;
  containsLink(text: string): boolean;
}

// --- Platform Specific Service Factory ---

/**
 * 支持的平台類型
 */
export type Platform = 'douyin' | 'tiktok';

/**
 * 特定平台的服務集合
 */
export interface PlatformServices {
  auth: AuthService;
  info: InfoService;
  download: DownloadService;
  parser: ParserService;
}

// 可以考慮添加一個工廠函數類型定義
// export type PlatformServiceFactory = (platform: Platform) => PlatformServices;
