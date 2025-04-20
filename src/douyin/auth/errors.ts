// Copied from src/auth/errors.ts
// Original file path: src/auth/errors.ts
/**
 * 錯誤類型定義
 * 提供認證與登入模組相關的特定錯誤類型
 */

/**
 * 登入錯誤
 * 用於表示登入過程中發生的錯誤
 */
export class LoginError extends Error {
  cause?: any;

  constructor(message: string, cause?: any) {
    super(`登入錯誤: ${message}`);
    this.name = 'LoginError';
    this.cause = cause;
  }
}

/**
 * Cookie 驗證錯誤
 * 用於表示 Cookie 驗證過程中發生的錯誤
 */
export class CookieValidationError extends Error {
  cause?: any;

  constructor(message: string, cause?: any) {
    super(`Cookie 驗證錯誤: ${message}`);
    this.name = 'CookieValidationError';
    this.cause = cause;
  }
}

/**
 * Cookie 存儲錯誤
 * 用於表示 Cookie 儲存或讀取過程中發生的錯誤
 */
export class CookieStorageError extends Error {
  cause?: any;

  constructor(message: string, cause?: any) {
    super(`Cookie 儲存錯誤: ${message}`);
    this.name = 'CookieStorageError';
    this.cause = cause;
  }
}