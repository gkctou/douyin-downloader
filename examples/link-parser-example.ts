/**
 * 抖音連結解析範例
 */

import { parseDouyinLinks } from '../src/douyin/parser';
import { infoLogger, LogLevel } from '../src/utils/logger'; // Updated path to shared utils

// 設置日誌級別
infoLogger.setLevel(LogLevel.DEBUG);

/**
 * 基本連結解析範例
 * 展示如何解析包含抖音連結的文本
 */
async function basicParseExample() {
  try {
    // 包含多種格式抖音連結的文本
    const text = `
      3.30 q@e.Ok IIv:/ 07/11 我们以后学什么，怎么学都会有很大变化# 自然流IP智能体  https://v.douyin.com/EMRK0d9Iqfk/ 复制此链接，打开Dou音搜索，直接观看视频！
    `;
    
    console.log('開始解析文本中的抖音連結...');
    // 基本解析，使用預設選項
    const results = await parseDouyinLinks(text);
    
    console.log(`>>>>>>成功解析出 ${results.length} 個連結：`);
    results.forEach((result, index) => {
      console.log(`\n--- 連結 ${index + 1} ---`);
      console.log(`原始連結: ${result.originalUrl}`);
      console.log(`標準化連結: ${result.standardUrl}`);
      console.log(`影片ID: ${result.id}`);
    });
  } catch (error) {
    console.error('基本連結解析失敗:', error);
  }
}

/**
 * 帶進度回調的連結解析範例
 */
async function progressCallbackExample() {
  try {
    // 包含多個連結的文本
    const text = `
      多個連結解析進度測試：
      3.30 q@e.Ok IIv:/ 07/11 我们以后学什么，怎么学都会有很大变化# 自然流IP智能体  https://v.douyin.com/EMRK0d9Iqfk/ 复制此链接，打开Dou音搜索，直接观看视频！
    `;
    
    console.log('開始解析文本中的抖音連結（帶進度回調）...');
    const results = await parseDouyinLinks(text, {
      // 添加進度回調
      onProgress: (current, total) => {
        console.log(`解析進度: ${current}/${total}`);
      },
      // 設置並行處理數
      concurrency: 2,
      // 設置重試次數
      retries: 2
    });
    
    console.log(`成功解析出 ${results.length} 個連結`);
  } catch (error) {
    console.error('帶進度回調的連結解析失敗:', error);
  }
}

/**
 * 處理大量連結的範例
 */
async function handleManyLinksExample() {
  try {
    // 生成包含多個連結的文本
    let text = '大量連結處理測試：\n';
    // 重複幾個連結來模擬大量連結的情況
    const links = [
      '3.30 q@e.Ok IIv:/ 07/11 我们以后学什么，怎么学都会有很大变化# 自然流IP智能体  https://v.douyin.com/EMRK0d9Iqfk/ 复制此链接，打开Dou音搜索，直接观看视频！',
      'https://www.douyin.com/video/7440784860962147611',
      'https://v.douyin.com/iLsVgmBh/'
    ];
    
    // 重複連結幾次以模擬大量連結
    for (let i = 0; i < 3; i++) {
      for (const link of links) {
        text += `${link}\n`;
      }
    }
    
    console.log('開始解析大量抖音連結...');
    const results = await parseDouyinLinks(text, {
      // 增加並行處理數以加快速度
      concurrency: 5,
      onProgress: (current, total) => {
        // 使用百分比顯示進度
        const percent = Math.floor((current / total) * 100);
        console.log(`解析進度: ${percent}%`);
      }
    });
    
    console.log(`成功解析出 ${results.length} 個連結`);
    // 只打印前5個結果
    console.log('前5個解析結果:');
    results.slice(0, 5).forEach((result, index) => {
      console.log(`${index + 1}. ${result.standardUrl}`);
    });
  } catch (error) {
    console.error('處理大量連結失敗:', error);
  }
}

/**
 * 處理錯誤連結的範例
 */
async function handleInvalidLinksExample() {
  try {
    // 包含有效和無效連結的文本
    const text = `
      有效和無效連結混合測試：
      有效: https://www.douyin.com/video/7440784860962147611
      無效: https://v.douyin.com/invalid-link/
      有效: https://v.douyin.com/ULmYBY9/
      不是抖音: https://www.example.com
    `;
    
    console.log('開始解析包含無效連結的文本...');
    const results = await parseDouyinLinks(text, {
      retries: 1, // 減少重試次數以加快處理無效連結的速度
    });
    
    console.log(`成功解析出 ${results.length} 個有效連結`);
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.originalUrl} -> ${result.standardUrl}`);
    });
  } catch (error) {
    console.error('處理無效連結失敗:', error);
  }
}

// 主函數：依次執行各個範例
async function main() {
  console.log('===== 基本連結解析範例 =====');
  await basicParseExample();
  
  // console.log('\n===== 帶進度回調的連結解析範例 =====');
  // await progressCallbackExample();
  
  // console.log('\n===== 處理大量連結的範例 =====');
  // await handleManyLinksExample();
  
  // console.log('\n===== 處理錯誤連結的範例 =====');
  // await handleInvalidLinksExample();
  
  console.log('\n所有範例執行完畢');
}

// 如果直接執行此檔案，則運行主函數
if (require.main === module) {
  main().catch(console.error);
}
