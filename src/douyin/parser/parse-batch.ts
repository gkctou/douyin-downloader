// Copied from src/parser/parse-batch.ts
// Original file path: src/parser/parse-batch.ts
/**
 * 批量解析模組
 * 並行處理多個抖音連結的解析
 */

import { parserLogger as logger } from '../../utils/logger'; // Updated path to shared utils logger
import { processBatch } from '../../utils/retry'; // Updated path to shared utils
import { ParseResult, ParseOptions } from '../../types'; // Adjusted import path
import { resolveLink } from './resolve-links';

/**
 * 批量解析抖音連結
 * @param urls 抖音連結陣列
 * @param options 解析選項
 * @returns Promise<ParseResult[]> 解析結果陣列
 */
export async function parseBatch(
  urls: string[],
  options: ParseOptions = {}
): Promise<ParseResult[]> {
  // 設置默認選項
  const { concurrency = 3, retries = 3, userAgent, onProgress } = options;

  logger.info(`開始批量解析 ${urls.length} 個抖音連結，並行數: ${concurrency}`);

  if (urls.length === 0) {
    logger.debug('沒有連結需要解析');
    return [];
  }

  // 使用 withConcurrency 並行處理所有連結
  const resolveOptions = { userAgent, retries };
  // processBatch returns { results, errors }
  const batchOutcome = await processBatch(
    urls,
    async (url: string, index: number): Promise<ParseResult | null> => { // Return type can be null
      logger.debug(`解析連結 #${index + 1}/${urls.length}: ${url}`);
      // resolveLink might return null on failure
      return await resolveLink(url, resolveOptions);
    },
    {
      concurrency,
      retries,
      // Pass the onProgress callback correctly to processBatch options
      onProgress: onProgress ? (completed, total, errors) => onProgress(completed, total) : undefined
    }
  );

  // Extract results and handle errors
  const successfulResults = batchOutcome.results.filter((r): r is ParseResult => r !== null); // Filter out nulls
  const errors = batchOutcome.errors;

  logger.info(`批量解析完成，成功解析 ${successfulResults.length}/${urls.length} 個連結`);
  if (errors.length > 0) {
      logger.warn(`解析過程中發生 ${errors.length} 個錯誤`);
  }

  return successfulResults;
}

/**
 * 批量解析抖音連結，包含更詳細的進度和結果信息
 * @param urls 抖音連結陣列
 * @param options 解析選項
 * @returns Promise<{ results: ParseResult[], stats: { total: number, success: number, failed: number } }>
 */
export async function parseBatchWithStats(
  urls: string[],
  options: ParseOptions = {}
): Promise<{
  results: ParseResult[];
  stats: {
    total: number;
    success: number;
    failed: number;
  }
}> {
  const results = await parseBatch(urls, options);

  return {
    results,
    stats: {
      total: urls.length,
      success: results.length,
      failed: urls.length - results.length
    }
  };
}