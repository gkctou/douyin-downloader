/**
 * 通用錯誤處理系統
 * 提供統一的錯誤類型和處理機制
 */

/**
 * 錯誤碼枚舉
 * 用於標識不同類型的錯誤
 */
export enum ErrorCode {
  // 通用錯誤
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',

  // 網絡相關錯誤
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',

  // 認證相關錯誤
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  COOKIE_INVALID = 'COOKIE_INVALID',
  COOKIE_EXPIRED = 'COOKIE_EXPIRED',
  CAPTCHA_REQUIRED = 'CAPTCHA_REQUIRED',

  // 解析相關錯誤
  PARSING_ERROR = 'PARSING_ERROR',
  INVALID_URL = 'INVALID_URL',

  // 資源相關錯誤
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  VIDEO_NOT_FOUND = 'VIDEO_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  CONTENT_RESTRICTED = 'CONTENT_RESTRICTED',

  // 下載相關錯誤
  DOWNLOAD_ERROR = 'DOWNLOAD_ERROR',
  DOWNLOAD_INTERRUPTED = 'DOWNLOAD_INTERRUPTED',

  // 文件系統錯誤
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // 瀏覽器相關錯誤
  BROWSER_ERROR = 'BROWSER_ERROR',
  BROWSER_LAUNCH_FAILED = 'BROWSER_LAUNCH_FAILED',

  // API 相關錯誤
  API_ERROR = 'API_ERROR'
}

/**
 * 應用程序錯誤類
 * 統一的錯誤類，包含錯誤碼、原因和其他信息
 */
export class AppError extends Error {
  /**
   * 創建應用程序錯誤
   * @param message 錯誤消息
   * @param code 錯誤碼，默認為 UNKNOWN_ERROR
   * @param cause 原始錯誤，用於錯誤鏈
   * @param details 錯誤詳情，可包含任何額外信息
   */
  constructor(
    message: string,
    public readonly code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    public readonly cause?: Error | unknown, // Allow unknown cause
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';

    // 捕獲堆棧跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }

    // 如果有原因錯誤，附加其堆棧
    if (this.cause && this.cause instanceof Error && this.cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${this.cause.stack}`;
    }
  }

  /**
   * 獲取完整的錯誤消息，包括錯誤碼和詳情
   */
  get fullMessage(): string {
    let msg = `[${this.code}] ${this.message}`;
    if (this.cause) {
      const causeMessage = this.cause instanceof Error ? this.cause.message : String(this.cause);
      msg += `\nCaused by: ${causeMessage}`;
    }
    if (this.details) {
      try {
        msg += `\nDetails: ${JSON.stringify(this.details)}`;
      } catch (e) {
        msg += `\nDetails: [無法序列化詳情]`;
      }
    }
    return msg;
  }

  /**
   * 判斷錯誤是否可重試
   * @returns 是否可重試
   */
  isRetryable(): boolean {
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.RATE_LIMIT_ERROR,
      ErrorCode.DOWNLOAD_INTERRUPTED,
      ErrorCode.BROWSER_ERROR,
      ErrorCode.API_ERROR // Consider if all API errors are retryable
    ];

    return retryableCodes.includes(this.code);
  }

  /**
   * 從通用錯誤創建 AppError
   * @param error 通用錯誤
   * @param code 錯誤碼，默認為 UNKNOWN_ERROR
   * @param defaultMessage 默認錯誤消息，如果原錯誤沒有消息
   * @returns AppError 實例
   */
  static from(
    error: unknown,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    defaultMessage: string = '未知錯誤'
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const errorObject = error instanceof Error ? error : new Error(
      typeof error === 'string' ? error : defaultMessage
    );

    return new AppError(errorObject.message, code, errorObject);
  }

  /**
   * 創建網絡錯誤
   * @param message 錯誤消息
   * @param cause 原始錯誤
   * @returns AppError 實例
   */
  static network(message: string, cause?: Error | unknown): AppError {
    return new AppError(message, ErrorCode.NETWORK_ERROR, cause);
  }

  /**
   * 創建認證錯誤
   * @param message 錯誤消息
   * @param cause 原始錯誤
   * @returns AppError 實例
   */
  static authentication(message: string, cause?: Error | unknown): AppError {
    return new AppError(message, ErrorCode.AUTHENTICATION_ERROR, cause);
  }

  /**
   * 創建解析錯誤
   * @param message 錯誤消息
   * @param cause 原始錯誤
   * @returns AppError 實例
   */
  static parsing(message: string, cause?: Error | unknown): AppError {
    return new AppError(message, ErrorCode.PARSING_ERROR, cause);
  }

  /**
   * 創建視頻未找到錯誤
   * @param message 錯誤消息
   * @param videoId 視頻ID
   * @returns AppError 實例
   */
  static videoNotFound(message: string, videoId?: string): AppError {
    return new AppError(
      message,
      ErrorCode.VIDEO_NOT_FOUND,
      undefined,
      videoId ? { videoId } : undefined
    );
  }

    /**
   * 創建用戶未找到錯誤
   * @param message 錯誤消息
   * @param userId 用戶ID
   * @returns AppError 實例
   */
  static userNotFound(message: string, userId?: string): AppError {
    return new AppError(
      message,
      ErrorCode.USER_NOT_FOUND,
      undefined,
      userId ? { userId } : undefined
    );
  }

  /**
   * 創建下載錯誤
   * @param message 錯誤消息
   * @param cause 原始錯誤
   * @param url 下載URL
   * @returns AppError 實例
   */
  static download(message: string, cause?: Error | unknown, url?: string): AppError {
    return new AppError(
      message,
      ErrorCode.DOWNLOAD_ERROR,
      cause,
      url ? { url } : undefined
    );
  }

  /**
   * 創建文件系統錯誤
   * @param message 錯誤消息
   * @param cause 原始錯誤
   * @param path 文件路徑
   * @returns AppError 實例
   */
  static fileSystem(message: string, cause?: Error | unknown, path?: string): AppError {
    return new AppError(
      message,
      ErrorCode.FILE_SYSTEM_ERROR,
      cause,
      path ? { path } : undefined
    );
  }

    /**
   * 創建權限錯誤
   * @param message 錯誤消息
   * @param cause 原始錯誤
   * @param path 文件路徑
   * @returns AppError 實例
   */
  static permissionDenied(message: string, cause?: Error | unknown, path?: string): AppError {
    return new AppError(
      message,
      ErrorCode.PERMISSION_DENIED,
      cause,
      path ? { path } : undefined
    );
  }

  /**
   * 創建瀏覽器錯誤
   * @param message 錯誤消息
   * @param cause 原始錯誤
   * @returns AppError 實例
   */
  static browser(message: string, cause?: Error | unknown): AppError {
    return new AppError(message, ErrorCode.BROWSER_ERROR, cause);
  }

  /**
   * 創建API錯誤
   * @param message 錯誤消息
   * @param cause 原始錯誤
   * @param statusCode HTTP狀態碼
   * @returns AppError 實例
   */
  static api(message: string, cause?: Error | unknown, statusCode?: number): AppError {
    return new AppError(
      message,
      ErrorCode.API_ERROR,
      cause,
      statusCode ? { statusCode } : undefined
    );
  }

  /**
   * 處理平台API特定錯誤 (需要平台特定實現來覆蓋或擴展)
   * @param apiResponse API響應
   * @param platform 平台標識 ('douyin', 'tiktok', etc.)
   * @returns AppError 實例
   */
  static fromApiResponse(apiResponse: any, platform: string = 'unknown'): AppError {
    // 這裡提供一個基礎實現，平台特定代碼應提供更詳細的解析
    console.warn(`[AppError] Platform-specific API error parsing not implemented for platform: ${platform}. Using generic parsing.`);

    // 嘗試通用解析
    if (apiResponse && typeof apiResponse.statusCode === 'number') {
      const { statusCode, statusMsg } = apiResponse;
      const message = statusMsg || `${platform} API 錯誤`;

      // 通用狀態碼處理
      if (statusCode === 401 || statusCode === 403) {
        return new AppError(message, ErrorCode.AUTHENTICATION_ERROR, undefined, { statusCode });
      }
      if (statusCode === 404) {
        return new AppError(message, ErrorCode.RESOURCE_ERROR, undefined, { statusCode });
      }
      if (statusCode === 429) {
        return new AppError(message, ErrorCode.RATE_LIMIT_ERROR, undefined, { statusCode });
      }
      if (statusCode >= 500) {
        return new AppError(message, ErrorCode.API_ERROR, undefined, { statusCode });
      }
      // 其他狀態碼視為通用 API 錯誤
      return new AppError(message, ErrorCode.API_ERROR, undefined, { statusCode, statusMsg });
    }

    // 如果沒有明確的狀態碼，返回通用API錯誤
    return new AppError(
      typeof apiResponse === 'string'
        ? apiResponse
        : `${platform} API 響應解析失敗`,
      ErrorCode.API_ERROR
    );
  }
}

/**
 * 解析錯誤消息中的HTTP狀態碼
 * @param error 錯誤對象
 * @returns 狀態碼或undefined
 */
export function parseHttpStatusFromError(error: Error | AppError): number | undefined {
  // Check AppError details first
  if (error instanceof AppError && error.details?.statusCode) {
    return error.details.statusCode;
  }

  const message = error.message;

  // 嘗試從消息中提取HTTP狀態碼
  const statusMatch = message.match(/(\b[45]\d\d\b)/);
  if (statusMatch) {
    return parseInt(statusMatch[1], 10);
  }

  // 檢查錯誤對象是否包含狀態碼
  if ('statusCode' in error && typeof (error as any).statusCode === 'number') {
    return (error as any).statusCode;
  }

  // 檢查錯誤對象是否包含響應對象
  if ('response' in error && (error as any).response) {
    const response = (error as any).response;
    if (typeof response.status === 'number') {
      return response.status;
    }
    if (typeof response.statusCode === 'number') {
      return response.statusCode;
    }
  }

  // Check cause if it exists
  if (error instanceof AppError && error.cause instanceof Error) {
      return parseHttpStatusFromError(error.cause);
  }


  return undefined;
}

/**
 * 解析常見的網絡錯誤
 * @param error 錯誤對象
 * @returns 標準化的AppError
 */
export function parseNetworkError(error: Error | AppError): AppError {
  // If it's already an AppError, return it, unless it's UNKNOWN
  if (error instanceof AppError && error.code !== ErrorCode.UNKNOWN_ERROR) {
      return error;
  }

  const originalError = error instanceof AppError ? error.cause || error : error;
  const message = originalError instanceof Error ? originalError.message.toLowerCase() : String(originalError).toLowerCase();
  const statusCode = parseHttpStatusFromError(error); // Parse from original error or AppError wrapper

  // 處理常見的狀態碼
  if (statusCode) {
    if (statusCode === 404) {
      return AppError.from(originalError, ErrorCode.RESOURCE_ERROR, '資源不存在');
    }
    if (statusCode === 401 || statusCode === 403) {
      return AppError.from(originalError, ErrorCode.AUTHENTICATION_ERROR, '認證失敗或無權訪問');
    }
    if (statusCode === 429) {
      return AppError.from(originalError, ErrorCode.RATE_LIMIT_ERROR, '請求過於頻繁，請稍後再試');
    }
    if (statusCode >= 500) {
      return AppError.from(originalError, ErrorCode.API_ERROR, '服務器錯誤，請稍後再試');
    }
  }

  // 處理常見的錯誤信息
  if (message.includes('timeout') || message.includes('timed out')) {
    return AppError.from(originalError, ErrorCode.TIMEOUT_ERROR, '網絡請求超時');
  }

  if (message.includes('network') || message.includes('connection') || message.includes('econnrefused') || message.includes('econnreset')) {
    return AppError.from(originalError, ErrorCode.NETWORK_ERROR, '網絡連接錯誤');
  }

  if (message.includes('captcha') || message.includes('人機驗證')) {
    return AppError.from(originalError, ErrorCode.CAPTCHA_REQUIRED, '需要進行人機驗證');
  }

  // 默認為通用網絡錯誤
  return AppError.network(originalError instanceof Error ? originalError.message : '網絡請求失敗', originalError);
}