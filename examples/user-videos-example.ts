/**
 * 抖音用戶影片列表獲取範例
 */

import { fetchUserVideos } from '../src/douyin/info';
import { loadCookie } from '../src/douyin/auth';
import { VideoInfo } from '../src/types'; // Import VideoInfo
import { downloadVideo } from '../src/douyin/download';
import path from 'path';
import fs from 'fs-extra';
import { infoLogger, LogLevel } from '../src/utils/logger'; // Updated path to shared utils

// 設置日誌級別
infoLogger.setLevel(LogLevel.DEBUG);

/**
 * 獲取用戶影片列表基本範例
 */
async function fetchUserVideosBasicExample() {
  try {
    // 載入 Cookie
    const cookie = await loadCookie();
    if (!cookie) {
      console.error('未找到有效的 Cookie，請先運行 login-example.ts 進行登入');
      return;
    }
    
    // 用戶頁面 URL (可以是任何有效的抖音用戶主頁 URL)
    const userUrl = 'https://www.douyin.com/user/MS4wLjABAAAAbLIgCOcN3prVLRb8zIXRdWfJTeGmpIpC_6BkFR5ruXM';
    
    console.log(`開始獲取用戶 ${userUrl} 的影片列表...`);
    // 設定獲取最多 5 個影片
    const limit = 5;
    
    const videos = await fetchUserVideos(userUrl, cookie, limit, {
      onProgress: (fetchedCount, totalEstimated) => {
        if (totalEstimated) {
          console.log(`獲取進度: ${fetchedCount}/${totalEstimated}`);
        } else {
          console.log(`已獲取 ${fetchedCount} 個影片`);
        }
      }
    });
    
    console.log(`成功獲取 ${videos.length} 個用戶影片的資訊:`);
    videos.forEach((video, index) => {
      console.log(`\n--- 影片 ${index + 1} ---`);
      console.log(`標題: ${video.description}`); // Use description
      console.log(`ID: ${video.id}`); // Use id
      console.log(`發布時間: ${new Date(video.createTime * 1000).toISOString()}`); // Use createTime
      console.log(`播放次數: ${video.stats?.playCount || '未知'}`); // Use stats.playCount
      console.log(`點讚數: ${video.stats?.likeCount || '未知'}`); // Use stats.likeCount
      console.log(`影片URL: ${video.videoPlayUrl || '未知'}`); // Use videoPlayUrl
    });
  } catch (error) {
    console.error('獲取用戶影片列表失敗:', error);
  }
}

/**
 * 獲取用戶所有影片範例
 */
async function fetchAllUserVideosExample() {
  try {
    // 載入 Cookie
    const cookie = await loadCookie();
    if (!cookie) {
      console.error('未找到有效的 Cookie，請先運行 login-example.ts 進行登入');
      return;
    }
    
    // 用戶頁面 URL
    const userUrl = 'https://www.douyin.com/user/MS4wLjABAAAAbLIgCOcN3prVLRb8zIXRdWfJTeGmpIpC_6BkFR5ruXM';
    
    console.log(`開始獲取用戶 ${userUrl} 的全部影片...`);
    // 設定 limit 為 0 表示獲取全部影片
    const limit = 0;
    
    // 追蹤進度
    let lastCount = 0;
    const startTime = Date.now();
    
    const videos = await fetchUserVideos(userUrl, cookie, limit, {
      onProgress: (fetchedCount) => {
        // 計算獲取速度
        const currentTime = Date.now();
        const elapsedSeconds = (currentTime - startTime) / 1000;
        const newItems = fetchedCount - lastCount;
        
        if (newItems > 0) {
          const itemsPerSecond = (fetchedCount / elapsedSeconds).toFixed(2);
          console.log(`已獲取 ${fetchedCount} 個影片，速度: ${itemsPerSecond} 影片/秒`);
          lastCount = fetchedCount;
        }
      }
    });
    
    console.log(`\n所有影片獲取完成，共 ${videos.length} 個影片`);
    
    // 將結果保存到 JSON 文件
    const outputDir = path.join(__dirname, 'output');
    await fs.ensureDir(outputDir);
    
    const fileName = `user_videos_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const outputPath = path.join(outputDir, fileName);
    
    await fs.writeJson(outputPath, videos, { spaces: 2 });
    console.log(`影片資訊已保存到 ${outputPath}`);
    
    // 顯示影片統計資訊
    if (videos.length > 0) {
      // 獲取最早和最新影片的時間
      const dates = videos.map(v => v.createTime); // Use createTime
      const earliest = new Date(Math.min(...dates) * 1000);
      const latest = new Date(Math.max(...dates) * 1000);
      
      console.log('\n--- 影片統計 ---');
      console.log(`時間範圍: ${earliest.toISOString()} 至 ${latest.toISOString()}`);
      
      // 計算總觀看次數和點讚
      const totalViews = videos.reduce((sum, v) => sum + (v.stats?.playCount || 0), 0); // Use stats.playCount
      const totalLikes = videos.reduce((sum, v) => sum + (v.stats?.likeCount || 0), 0); // Use stats.likeCount
      
      console.log(`總觀看次數: ${totalViews.toLocaleString()}`);
      console.log(`總點讚數: ${totalLikes.toLocaleString()}`);
      
      // 平均數據
      const avgViews = Math.round(totalViews / videos.length);
      const avgLikes = Math.round(totalLikes / videos.length);
      
      console.log(`平均觀看次數: ${avgViews.toLocaleString()}`);
      console.log(`平均點讚數: ${avgLikes.toLocaleString()}`);
    }
  } catch (error) {
    console.error('獲取所有用戶影片失敗:', error);
  }
}

/**
 * 下載用戶最新影片範例
 */
async function downloadLatestUserVideosExample() {
  try {
    // 載入 Cookie
    const cookie = await loadCookie();
    if (!cookie) {
      console.error('未找到有效的 Cookie，請先運行 login-example.ts 進行登入');
      return;
    }
    
    // 用戶頁面 URL
    const userUrl = 'https://www.douyin.com/user/MS4wLjABAAAAbLIgCOcN3prVLRb8zIXRdWfJTeGmpIpC_6BkFR5ruXM';
    
    // 獲取用戶名稱（假設從URL中提取）
    const userIdMatch = userUrl.match(/user\/([^?&/]+)/);
    const userId = userIdMatch ? userIdMatch[1] : 'unknown';
    
    console.log(`開始獲取用戶 ${userId} 的最新影片...`);
    // 獲取最新的 3 個影片
    const limit = 3;
    
    const videos = await fetchUserVideos(userUrl, cookie, limit);
    
    if (videos.length === 0) {
      console.log('沒有找到任何影片');
      return;
    }
    
    console.log(`找到 ${videos.length} 個最新影片，準備下載...`);
    
    // 創建下載目錄
    const downloadDir = path.join(__dirname, 'downloads', userId);
    await fs.ensureDir(downloadDir);
    
    // 逐個下載影片
    for (const [index, video] of videos.entries()) {
      if (!video.videoPlayUrl) { // Use videoPlayUrl
        console.error(`影片 ${video.id} 沒有可用的下載URL，跳過`); // Use id
        continue;
      }
      
      // 格式化時間為 YYYYMMDD 格式
      const publishDate = new Date(video.createTime * 1000); // Use createTime
      const dateStr = publishDate.toISOString().slice(0, 10).replace(/-/g, '');
      
      // 格式化影片標題，去除非法字符
      const sanitizedTitle = (video.description || 'untitled').replace(/[\\/:*?"<>|]/g, '_'); // Use description
      
      // 生成最終文件名
      const fileName = `${dateStr}-${sanitizedTitle.slice(0, 50)}.mp4`;
      const outputPath = path.join(downloadDir, fileName);
      
      console.log(`\n[${index + 1}/${videos.length}] 下載影片: ${video.description || '無標題'}`); // Use description
      console.log(`ID: ${video.id}`); // Use id
      console.log(`發布時間: ${publishDate.toISOString()}`);
      console.log(`輸出路徑: ${outputPath}`);
      
      try {
        // 將 video 物件轉換為 VideoInfoResult 格式
        const videoInfo: VideoInfo = { // Use common VideoInfo type
          id: video.id, // Use id
          title: video.description || '無標題', // Use description
          videoPlayUrl: video.videoPlayUrl || '', // Use videoPlayUrl
          userName: video.author.nickname,
          userUrl: `https://www.douyin.com/user/${video.author.id}`, // Use author.id
          releaseDate: publishDate.toISOString(),
          description: video.description // Add description
        };
        
        // 下載影片
        await downloadVideo(
          videoInfo, 
          outputPath, 
          { // Use onFileProgress
            onFileProgress: (progress: number) => {
              const percent = Math.floor(progress);
              if (percent % 10 === 0 && percent > 0) {
                console.log(`  文件下載進度: ${percent}%`);
              }
            }
          }
        );
        
        console.log(`影片下載完成: ${outputPath}`);
      } catch (downloadError) {
        console.error(`影片下載失敗:`, downloadError);
      }
    }
    
    console.log('\n所有影片下載完成');
  } catch (error) {
    console.error('下載用戶最新影片失敗:', error);
  }
}

/**
 * 按時間範圍獲取用戶影片範例
 * (使用假設的時間範圍參數，實際 API 可能需要自行過濾)
 */
async function fetchUserVideosByDateRangeExample() {
  try {
    // 載入 Cookie
    const cookie = await loadCookie();
    if (!cookie) {
      console.error('未找到有效的 Cookie，請先運行 login-example.ts 進行登入');
      return;
    }
    
    // 用戶頁面 URL
    const userUrl = 'https://www.douyin.com/user/MS4wLjABAAAAbLIgCOcN3prVLRb8zIXRdWfJTeGmpIpC_6BkFR5ruXM';
    
    console.log(`開始獲取用戶影片並按時間範圍過濾...`);
    
    // 獲取所有影片（一般實際使用時會使用 API 參數限制，這裡為了演示先獲取全部再過濾）
    const allVideos = await fetchUserVideos(userUrl, cookie, 20, {
      onProgress: (count) => {
        console.log(`已獲取 ${count} 個影片`);
      }
    });
    
    console.log(`獲取到 ${allVideos.length} 個影片，開始按時間過濾...`);
    
    // 設定時間範圍 (示例：過去30天)
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    // 過濾在時間範圍內的影片
    const filteredVideos = allVideos.filter(video => {
      const videoDate = new Date(video.createTime * 1000); // Use createTime
      return videoDate >= thirtyDaysAgo && videoDate <= now;
    });
    
    console.log(`在過去 30 天內發布的影片有 ${filteredVideos.length} 個`);
    
    if (filteredVideos.length > 0) {
      // 按發布時間排序（從新到舊）
      filteredVideos.sort((a, b) => b.createTime - a.createTime); // Use createTime
      
      console.log('\n--- 過去 30 天的影片列表 ---');
      filteredVideos.forEach((video, index) => {
        const date = new Date(video.createTime * 1000).toISOString().slice(0, 10); // Use createTime
        const titlePreview = video.description ? `${video.description.slice(0, 50)}${video.description.length > 50 ? '...' : ''}` : '無標題'; // Use description
        console.log(`${index + 1}. [${date}] ${titlePreview}`);
      });
    }
  } catch (error) {
    console.error('按時間範圍獲取用戶影片失敗:', error);
  }
}

// 主函數：依次執行各個範例
async function main() {
  console.log('===== 獲取用戶影片列表基本範例 =====');
  await fetchUserVideosBasicExample();
  
  console.log('\n===== 獲取用戶所有影片範例 =====');
  // 註釋掉以避免過長運行時間
  // await fetchAllUserVideosExample();
  
  console.log('\n===== 下載用戶最新影片範例 =====');
  await downloadLatestUserVideosExample();
  
  console.log('\n===== 按時間範圍獲取用戶影片範例 =====');
  await fetchUserVideosByDateRangeExample();
  
  console.log('\n所有範例執行完畢');
}

// 如果直接執行此檔案，則運行主函數
if (require.main === module) {
  main().catch(console.error);
}
