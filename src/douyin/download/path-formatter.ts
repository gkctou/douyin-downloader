// Copied from src/download/path-formatter.ts
// Original file path: src/download/path-formatter.ts
/**
 * 檔名和路徑管理
 * 提供格式化檔名和路徑的功能
 */

import fs from 'fs-extra';
import path from 'path';
import sanitize from 'sanitize-filename';
import { VideoInfo } from '../../types'; // Use common VideoInfo
import { downloadLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { getSafeFilename } from '../../utils/file'; // Import from shared utils

/**
 * 格式化輸出路徑選項
 */
export interface PathFormatterOptions {
  useSubfolders?: boolean; // 是否使用子資料夾（按使用者名稱），預設 true
  filenameTemplate?: string; // 檔名模板，預設 "{date}-{title}"
  maxFilenameLength?: number; // 檔名最大長度，預設 200
}

/**
 * 獲取安全的檔案名（替換非法字符）
 * @param filename 原始檔案名
 * @param maxLength 最大長度限制
 * @returns 安全的檔案名
 */
// Moved getSafeFilename to src/utils/file.ts

/**
 * 格式化日期字符串
 * @param dateStr 日期字符串 (ISO 格式或 YYYY-MM-DD)
 * @returns 格式化後的日期 (YYYYMMDD)
 */
export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return new Date().toISOString().slice(0, 10).replace(/-/g, '');
    }

    return date.toISOString().slice(0, 10).replace(/-/g, '');
  } catch (error) {
    // 如果解析失敗，使用當前日期
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }
}

/**
 * 應用檔名模板
 * @param template 模板字符串
 * @param videoInfo 影片資訊
 * @returns 應用模板後的字符串
 */
export function applyFilenameTemplate(
  template: string,
  videoInfo: VideoInfo // Use common VideoInfo
): string {
  // 將可用的變數替換為實際值
  return template
    .replace(/{id}/g, videoInfo.id || 'unknown')
    .replace(/{title}/g, videoInfo.title || 'untitled')
    .replace(/{date}/g, formatDate(videoInfo.releaseDate || ''))
    .replace(/{user}/g, videoInfo.userName || 'unknown_user');
}

/**
 * 格式化輸出路徑
 * 根據影片資訊和選項，確定檔案的完整路徑
 * @param videoInfo 影片資訊
 * @param baseOutputPath 基本輸出路徑
 * @param options 格式化選項
 * @returns 格式化後的完整檔案路徑
 */
export function formatOutputPath(
  videoInfo: VideoInfo, // Use common VideoInfo
  baseOutputPath: string,
  options: PathFormatterOptions = {}
): string {
  const {
    useSubfolders = true,
    filenameTemplate = "{date}-{title}",
    maxFilenameLength = 200
  } = options;

  // 檢查基本路徑是否是目錄
  let isDirectory = false;
  try {
    isDirectory = fs.statSync(baseOutputPath).isDirectory();
  } catch (error) {
    // 檢查路徑是否以目錄分隔符結尾
    isDirectory = baseOutputPath.endsWith(path.sep) || baseOutputPath.endsWith('/');
  }

  // 如果是目錄，根據選項決定使用子資料夾
  if (isDirectory) {
    let targetDir = baseOutputPath;

    // 如果使用子資料夾，則添加使用者名稱資料夾
    if (useSubfolders && videoInfo.userName) {
      const userDirName = getSafeFilename(videoInfo.userName || 'unknown_user'); // Remove second argument
      targetDir = path.join(baseOutputPath, userDirName);
    }

    // 應用檔名模板並限制長度
    // Apply template first, then sanitize the result using the single-argument getSafeFilename
    const templateAppliedName = applyFilenameTemplate(filenameTemplate, videoInfo);
    const filename = getSafeFilename(templateAppliedName); // Remove second argument

    // 確保檔名有 .mp4 擴展名
    const finalName = filename.toLowerCase().endsWith('.mp4')
      ? filename
      : `${filename}.mp4`;

    return path.join(targetDir, finalName);
  } else {
    // 如果不是目錄，則直接使用指定的檔案路徑
    let finalPath = baseOutputPath;

    // 確保檔案擴展名為 .mp4
    if (!finalPath.toLowerCase().endsWith('.mp4')) {
      finalPath += '.mp4';
    }

    return finalPath;
  }
}

// Moved ensureDirectoryExists to src/utils/file.ts