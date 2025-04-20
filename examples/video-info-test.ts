/**
 * 影片資訊獲取模組測試範例
 */

import { fetchVideosInfoText, fetchVideosInfoUrls, fetchUserVideos } from '../src/douyin/info'; // Remove cleanupBrowser import
import { loadCookie } from '../src/douyin/auth';
import { infoLogger, LogLevel } from '../src/utils/logger'; // Updated path to shared utils
import { cleanupBrowser } from '../src/utils/browser'; // Import cleanupBrowser from shared utils
import path from 'path';

// 設置日誌級別
infoLogger.setLevel(LogLevel.DEBUG);

/**
 * 測試從文本中提取影片資訊
 */
async function testFetchFromText() {
  try {
    // 載入 Cookie
    // const cookie = await loadCookie(path.resolve(__dirname, 'cookie.txt'));
    const cookie = await loadCookie();
    if (!cookie) {
      console.error('未找到有效的 Cookie，請先運行 dydl login 命令');
      return;
    }

    // 測試文本
    const text = `0.23 oDu:/ Q@K.Wz 07/14 下条视频再来详细讲讲具体思路# 自然流IP智能体  https://v.douyin.com/c-mY7xDr-qA/ 复制此链接，打开Dou音搜索，直接观看视频！ https://www.douyin.com/video/7481245318437211419 https://www.douyin.com/video/7488185546636856585`;

    console.log('開始從文本中提取影片資訊...');
    const results = await fetchVideosInfoText(text, cookie, {
      onProgress: (current, total) => {
        console.log(`進度: ${current}/${total}`);
      }
    });

    console.log(`成功獲取 ${results.length} 個影片的資訊:`);
    results.forEach((video, index) => {
      console.log(`\n--- 影片 ${index + 1} ---`);
      console.log(`標題: ${video.title}`);
      console.log(`作者: ${video.userName}`);
      console.log(`發布日期: ${video.releaseDate}`);
      console.log(`影片URL: ${video.videoPlayUrl}`);
    });
  } catch (error) {
    console.error('測試失敗:', error);
  }
}

/**
 * 測試從 URL 列表中提取影片資訊
 */
async function testFetchFromUrls() {
  try {
    // 載入 Cookie
    const cookie = await loadCookie(path.resolve(__dirname, 'cookie.txt'));
    if (!cookie) {
      console.error('未找到有效的 Cookie，請先運行 dydl login 命令');
      return;
    }

    // 影片 URL 列表
    const urls = [
      'https://www.douyin.com/video/7481245318437211419',
      'https://www.douyin.com/video/7488185546636856585'
    ];

    console.log('開始從 URL 列表中提取影片資訊...');
    const results = await fetchVideosInfoUrls(urls, cookie);

    console.log(`成功獲取 ${results.length} 個影片的資訊:`);
    results.forEach((video, index) => {
      console.log(`\n--- 影片 ${index + 1} ---`);
      console.log(`標題: ${video.title}`);
      console.log(`作者: ${video.userName}`);
      console.log(`發布日期: ${video.releaseDate}`);
      console.log(`影片URL: ${video.videoPlayUrl}`);
    });
  } catch (error) {
    console.error('測試失敗:', error);
  }
}

/**
 * 測試獲取用戶影片列表
 */
async function testFetchUserVideos() {
  try {
    // 載入 Cookie
    const cookie = await loadCookie(path.resolve(__dirname, 'cookie.txt'));
    if (!cookie) {
      console.error('未找到有效的 Cookie，請先運行 dydl login 命令');
      return;
    }

    // 用戶 URL
    // const userUrl = 'https://www.douyin.com/user/MS4wLjABAAAAbLIgCOcN3prVLRb8zIXRdWfJTeGmpIpC_6BkFR5ruXM';
    const userUrl = 'https://www.douyin.com/user/MS4wLjABAAAASVzXO5IPKmqv_d8EUxXe_cdpEv_aDnoGbWmAxq8atbMUwufe1AOl4F_LlhrMU5dt?from_tab_name=main&vid=7488780178240310562';
    console.log('開始獲取用戶影片列表...');
    const results = await fetchUserVideos(userUrl, cookie, 0, { // 設置為0表示獲取全部影片
      onProgress: (current, total) => {
        console.log(`進度: ${current}${total ? `/${total}` : ''}`);
      }
    });

    console.log(`成功獲取 ${results.length} 個用戶影片的資訊:`);
    results.forEach((video, index) => {
      console.log(`\n--- 影片 ${index + 1} ---`);
      console.log(`標題: ${video.description}`); // Use description
      console.log(`作者: ${video.author.nickname}`);
      console.log(`創建時間: ${new Date(video.createTime * 1000).toISOString()}`); // Use createTime
      console.log(`影片URL: ${video.videoPlayUrl}`); // Use videoPlayUrl
    });
  } catch (error) {
    console.error('測試失敗:', error);
  }
}

/**
 * 測試獲取用戶影片列表並顯示備用URL
 */
async function testFetchUserVideosWithBackupUrls() {
  try {
    // 載入 Cookie
    const cookie = await loadCookie(path.resolve(__dirname, 'cookie.txt'));
    if (!cookie) {
      console.error('未找到有效的 Cookie，請先運行 dydl login 命令');
      return;
    }

    // 用戶 URL
    const userUrl = 'https://www.douyin.com/user/MS4wLjABAAAASVzXO5IPKmqv_d8EUxXe_cdpEv_aDnoGbWmAxq8atbMUwufe1AOl4F_LlhrMU5dt?from_tab_name=main&vid=7488780178240310562';
    console.log('開始獲取用戶影片列表並檢查備用URL...');
    const results = await fetchUserVideos(userUrl, cookie, 0, { // 只獲取5個影片用於測試
      onProgress: (current, total) => {
        console.log(`進度: ${current}${total ? `/${total}` : ''}`);
      }
    });

    console.log(`成功獲取 ${results.length} 個用戶影片的資訊:`);
    results.forEach((video, index) => {
      // console.log('video', video.video || '');
      console.log(`\n--- 影片 ${index + 1} ---`);
      console.log(`標題: ${video.description}`); // Use description
      console.log(`ID: ${video.id}`); // Use id
      console.log(`作者: ${video.author.nickname}`);
      console.log(`創建時間: ${new Date(video.createTime * 1000).toISOString()}`); // Use createTime
      console.log(`影片播放URL: ${video.videoPlayUrl}`); // Use videoPlayUrl

      // 顯示下載URL
      // Note: download_url and cdn_list are not part of the common UserVideoItem interface.
      // If these are needed, they should be handled within the platform-specific implementation
      // or the UserVideoItem interface needs to be extended (potentially using platform-specific types).
      // For now, we comment out this section as it relies on removed properties.
      /*
      if (video.download_url) {
        console.log(`官方下載URL: ${video.download_url}`);
      } else {
        console.log('沒有官方下載URL');
      }

      // 顯示CDN URL列表
      if (video.cdn_list && video.cdn_list.length > 0) {
        console.log(`CDN URL數量: ${video.cdn_list.length}`);
        video.cdn_list.forEach((url, urlIndex) => {
          console.log(`CDN URL ${urlIndex + 1}: ${url}`);
        });
      } else {
        console.log('沒有CDN URL');
      }
      */

    });
  } catch (error) {
    console.error('測試失敗:', error);
  }
}

// 執行測試
async function runTests() {
  try {
    // console.log('===== 測試從文本中提取影片資訊 =====');
    // await testFetchFromText();

    // console.log('\n===== 測試從 URL 列表中提取影片資訊 =====');
    // await testFetchFromUrls();

    console.log('\n===== 測試獲取用戶影片列表 =====');
    await testFetchUserVideos();

    // console.log('\n===== 測試獲取用戶影片列表並顯示備用URL =====');
    // await testFetchUserVideosWithBackupUrls();
  } finally {
    // 確保在測試完成後關閉瀏覽器
    console.log('測試完成，正在清理瀏覽器資源...');
    await cleanupBrowser();
  }
}

// 執行所有測試
runTests().catch(async (error) => {
  console.error(error);
  // 確保在發生錯誤時也能關閉瀏覽器
  await cleanupBrowser();
});
