/**
 * 抖音解析與下載完整工作流程範例
 * 展示從登入到解析連結、獲取影片資訊、下載影片的完整流程
 */

import { login, isValidCookie, loadCookie, saveCookie } from '../src/douyin/auth';
import { parseDouyinLinks } from '../src/douyin/parser';
import { fetchVideosInfoUrls, fetchUserVideos } from '../src/douyin/info'; // Remove cleanupBrowser import from here
import { downloadVideo } from '../src/douyin/download';
import { VideoInfo, UserVideoItem } from '../src/types'; // Updated import
import path from 'path';
import fs from 'fs-extra';
import { infoLogger, LogLevel } from '../src/utils/logger'; // Updated path to shared utils
import { cleanupBrowser } from '../src/utils/browser'; // Import cleanupBrowser from shared utils

// 設置日誌級別
infoLogger.setLevel(LogLevel.DEBUG);

/**
 * 完整流程範例：檢查並準備 Cookie -> 解析連結 -> 獲取影片資訊 -> 下載影片
 */
async function completeWorkflowExample(inputText: string) {
  console.log('===== 開始完整流程範例 =====');
  const outputDir = path.join(__dirname, 'complete_output');
  await fs.ensureDir(outputDir);

  // 步驟 1: 檢查並準備 Cookie
  console.log('\n步驟 1: 檢查 Cookie 有效性');
  let cookie = await loadCookie();

  if (!cookie) {
    console.log('未找到 Cookie，需要執行登入流程');
    // 註釋以下代碼以避免實際運行時開啟瀏覽器
    // cookie = await login();
    // if (cookie) {
    //   await saveCookie(cookie);
    //   console.log('登入成功，Cookie 已保存');
    // } else {
    //   console.error('登入失敗，無法繼續');
    //   return;
    // }

    // 為演示目的，如果未找到 Cookie，直接退出
    console.error('未找到 Cookie，請先運行 login-example.ts 進行登入');
    return;
  }

  // 驗證 Cookie 有效性
  const isValid = await isValidCookie(cookie);
  if (!isValid) {
    console.error('Cookie 已失效，請重新登入');
    return;
  }

  console.log('Cookie 有效，繼續執行');

  // 步驟 2: 解析輸入文本中的抖音連結
  console.log('\n步驟 2: 解析輸入文本中的抖音連結');
  console.log(`輸入文本: ${inputText}`);

  const parseResults = await parseDouyinLinks(inputText, {
    onProgress: (current, total) => {
      console.log(`解析進度: ${current}/${total}`);
    }
  });

  if (parseResults.length === 0) {
    console.log('未找到有效的抖音連結，嘗試作為用戶主頁處理');

    // 檢查輸入是否為用戶主頁連結
    if (inputText.includes('douyin.com/user/')) {
      await processUserPage(inputText, cookie, outputDir);
    } else {
      console.error('未找到有效的抖音連結或用戶主頁');
    }
    return;
  }

  console.log(`找到 ${parseResults.length} 個抖音連結`);
  parseResults.forEach((result, index) => {
    console.log(`${index + 1}. ${result.originalUrl} -> ${result.standardUrl}`);
  });

  // 步驟 3: 獲取影片資訊
  console.log('\n步驟 3: 獲取影片資訊');
  const standardUrls = parseResults.map(result => result.standardUrl);

  const videoInfos = await fetchVideosInfoUrls(standardUrls, cookie, {
    onProgress: (current, total) => {
      console.log(`獲取資訊進度: ${current}/${total}`);
    }
  });

  if (videoInfos.length === 0) {
    console.error('未能獲取任何影片資訊');
    return;
  }

  console.log(`成功獲取 ${videoInfos.length} 個影片的資訊`);

  // 將資訊保存到 JSON 文件
  const infoPath = path.join(outputDir, 'video_info.json');
  await fs.writeJson(infoPath, videoInfos, { spaces: 2 });
  console.log(`影片資訊已保存到 ${infoPath}`);

  // 步驟 4: 下載影片
  console.log('\n步驟 4: 下載影片');
  const videosDir = path.join(outputDir, 'videos');
  await fs.ensureDir(videosDir);

  // 記錄成功和失敗的下載
  const results = {
    success: [] as string[],
    failed: [] as string[]
  };

  for (const [index, videoInfo] of videoInfos.entries()) {
    // 為每個作者創建子目錄
    const authorDir = path.join(videosDir, (videoInfo.userName || 'unknown_author').replace(/[\\/:*?"<>|]/g, '_')); // Added fallback for userName
    await fs.ensureDir(authorDir);

    // 生成檔案名稱，包含發布日期
    const sanitizedTitle = (videoInfo.title || 'untitled').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50); // Added fallback for title
    const datePrefix = videoInfo.releaseDate ? `${videoInfo.releaseDate}-` : ''; // Add date prefix only if available
    const fileName = `${datePrefix}${sanitizedTitle}.mp4`;
    const outputPath = path.join(authorDir, fileName);

    console.log(`\n[${index + 1}/${videoInfos.length}] 下載影片: ${videoInfo.title}`);
    console.log(`作者: ${videoInfo.userName}`);
    console.log(`輸出路徑: ${outputPath}`);

    try {
      await downloadVideo(videoInfo, outputPath, {
        // Use onFileProgress for individual file download progress
        onFileProgress: (progress: number) => {
          const percent = Math.floor(progress);
          // Log individual file progress
          if (percent % 25 === 0 && percent > 0) { // Keep original logging frequency for this example
            console.log(`  文件下載進度: ${percent}%`);
          }
        }
      });

      console.log(`影片下載完成: ${outputPath}`);
      results.success.push(videoInfo.title);
    } catch (downloadError) {
      console.error(`影片下載失敗:`, downloadError);
      results.failed.push(videoInfo.title);
    }
  }

  // 步驟 5: 顯示最終結果
  console.log('\n步驟 5: 下載結果總結');
  console.log(`成功下載: ${results.success.length} 個影片`);
  console.log(`下載失敗: ${results.failed.length} 個影片`);

  if (results.failed.length > 0) {
    console.log('\n下載失敗的影片:');
    results.failed.forEach((title, index) => {
      console.log(`${index + 1}. ${title}`);
    });
  }

  console.log('\n===== 完整流程範例執行完畢 =====');
}

/**
 * 處理用戶主頁 URL
 */
async function processUserPage(userUrl: string, cookie: string, outputDir: string) {
  console.log(`處理用戶主頁: ${userUrl}`);

  // 提取用戶 ID (簡單方式，實際應用可能需要更複雜的處理)
  const userIdMatch = userUrl.match(/user\/([^?&/]+)/);
  const userId = userIdMatch ? userIdMatch[1] : 'unknown';

  console.log(`獲取用戶 ${userId} 的最新影片...`);
  // 設定獲取的影片數量
  const limit = 5;

  try {
    const videos = await fetchUserVideos(userUrl, cookie, limit, {
      onProgress: (count) => {
        console.log(`已獲取 ${count} 個影片`);
      }
    });

    if (videos.length === 0) {
      console.log('未獲取到任何影片');
      return;
    }

    console.log(`成功獲取 ${videos.length} 個用戶影片`);

    // 保存影片信息
    const infoPath = path.join(outputDir, `user_${userId}_videos.json`);
    await fs.writeJson(infoPath, videos, { spaces: 2 });
    console.log(`用戶影片資訊已保存到 ${infoPath}`);

    // 下載影片
    const userDir = path.join(outputDir, 'user_videos', userId);
    await fs.ensureDir(userDir);

    for (const [index, video] of videos.entries()) {
      // Use videoPlayUrl from the new UserVideoItem type
      if (!video.videoPlayUrl) {
        console.log(`影片 ${video.id} 沒有可用的下載 URL，跳過`);
        continue;
      }

      // 格式化時間為 YYYYMMDD 格式
      const publishDate = new Date(video.createTime * 1000); // Use createTime
      const dateStr = publishDate.toISOString().slice(0, 10).replace(/-/g, '');

      // 格式化影片標題
      const sanitizedTitle = (video.description || 'untitled').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50); // Use description
      const fileName = `${dateStr}-${sanitizedTitle}.mp4`;
      const outputPath = path.join(userDir, fileName);

      console.log(`\n[${index + 1}/${videos.length}] 下載影片: ${video.description || '無標題'}`); // Use description

      try {
        // UserVideoItem already contains most needed info, map to VideoInfo for downloadVideo
        const videoInfo: VideoInfo = {
          id: video.id, // Use id
          title: video.description || '無標題', // Use description
          videoPlayUrl: video.videoPlayUrl || '', // Use videoPlayUrl
          userName: video.author.nickname,
          userUrl: `https://www.douyin.com/user/${video.author.id}`, // Use author.id
          releaseDate: new Date(video.createTime * 1000).toISOString().split('T')[0], // Use createTime
          description: video.description
        };
        // Ensure videoPlayUrl is valid before attempting download
        if (!videoInfo.videoPlayUrl) {
            console.error(`影片 ${videoInfo.id} 缺少 videoPlayUrl，無法下載`);
            continue;
        }

        await downloadVideo(videoInfo, outputPath, {
          // Use the new onFileProgress for individual file download progress
          onFileProgress: (progress: number) => { // Explicitly type progress
            const percent = Math.floor(progress);
            // Log individual file progress
            if (percent % 25 === 0 && percent > 0) {
              console.log(`  文件下載進度: ${percent}%`);
            }
          }
        });

        console.log(`影片下載完成: ${outputPath}`);
      } catch (downloadError) {
        console.error(`影片下載失敗:`, downloadError);
      }
    }

    console.log('用戶影片處理完畢');
  } catch (error) {
    console.error('處理用戶主頁時出錯:', error);
  }
}

// 主函數
async function main() {
  // 範例輸入，可以是包含多個抖音鏈接的文本，或是一個用戶主頁 URL
  const inputText = `
    推薦幾個好看的抖音：
    https://www.douyin.com/video/7440784860962147611
    還有這個短連結 https://v.douyin.com/ULmYBY9/
    
    也可以看看這個用戶：
    https://www.douyin.com/user/MS4wLjABAAAAbLIgCOcN3prVLRb8zIXRdWfJTeGmpIpC_6BkFR5ruXM
  `;

  // 執行完整流程範例
  await completeWorkflowExample(inputText);
// ... (rest of the file)
  await cleanupBrowser(); // Use imported cleanupBrowser
  process.exit(0);
}

// 如果直接執行此檔案，則運行主函數
if (require.main === module) {
  main().catch(console.error);
}
