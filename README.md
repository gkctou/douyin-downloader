# 抖音影片解析與下載工具 (douyin-downloader)

[![NPM version](https://img.shields.io/npm/v/douyin-downloader.svg?style=flat)](https://www.npmjs.com/package/douyin-downloader)
[![License](https://img.shields.io/npm/l/douyin-downloader.svg?style=flat)](https://github.com/gkctou/douyin-downloader/blob/main/LICENSE)

一個基於 Node.js 和 Puppeteer 的命令列工具，用於解析和下載抖音 (Douyin) 影片，並獲取影片及用戶資訊。

## ✨ 功能特性

*   **影片下載**: 下載指定的單一抖音影片。
*   **影片資訊**: 獲取影片的詳細資訊 (作者、標題、發布時間等)。
*   **用戶影片列表**: 獲取指定用戶發布的所有影片連結列表。
*   **登入與驗證**: 支援透過掃描 QR Code 登入抖音帳號，並驗證登入狀態。
*   **自訂輸出**: 可指定下載目錄和檔案名稱，或將資訊輸出至檔案。
*   **瀏覽器操作**: 可開啟已載入 Cookie 的瀏覽器實例。
*   **詳細日誌**: 提供詳細模式 (`--verbose`) 以方便調試。

## 🚀 安裝

確保您的系統已安裝 Node.js (建議版本 >= 20.0.0) 和 npm。

```bash
npm install -g douyin-downloader
```

或者，如果您不想全域安裝，可以使用 `npx`:

```bash
npx dydl <命令> [選項]
```

## 🛠️ 使用說明

`douyin-downloader` 提供了一個名為 `dydl` 的命令列介面。

### 基本命令格式

```bash
dydl <命令> [選項] [參數]
```

### 可用命令

*   **`login`**: 登入抖音帳號並儲存 Cookie。
    ```bash
    dydl login
    ```
    執行後會開啟瀏覽器顯示 QR Code，請使用抖音 App 掃描登入。Cookie 將儲存於預設路徑。

*   **`check`**: 檢查已儲存的 Cookie 是否有效。
    ```bash
    dydl check
    ```

*   **`open`**: 開啟一個已載入 Cookie 的瀏覽器實例。
    ```bash
    dydl open
    ```

*   **`video <影片連結>`**: 下載單個影片。
    ```bash
    # 下載影片到目前目錄
    dydl video https://v.douyin.com/xxxxxxx/

    # 指定下載目錄
    dydl video -d ./downloads https://v.douyin.com/xxxxxxx/

    # 指定下載目錄和檔案名稱 (注意: -f 僅適用於單個影片下載)
    dydl video -d ./downloads -f my_video.mp4 https://v.douyin.com/xxxxxxx/
    ```

*   **`info <影片連結>`**: 獲取影片資訊。
    ```bash
    # 輸出資訊到控制台
    dydl info https://v.douyin.com/xxxxxxx/

    # 輸出資訊到 JSON 檔案
    dydl info -f video_info.json https://v.douyin.com/xxxxxxx/
    ```

*   **`list <用戶主頁連結>`**: 獲取用戶影片列表。
    ```bash
    # 獲取用戶所有影片列表並輸出到控制台
    dydl list https://www.douyin.com/user/MS4wLjABAAAAxxxxxxxxxxxxxxxx

    # 獲取用戶最新的 10 個影片列表
    dydl list -n 10 https://www.douyin.com/user/MS4wLjABAAAAxxxxxxxxxxxxxxxx

    # 獲取用戶影片列表並輸出到 JSON 檔案
    dydl list -f user_videos.json https://www.douyin.com/user/MS4wLjABAAAAxxxxxxxxxxxxxxxx
    ```

### 全局選項

*   **`-v, --verbose`**: 顯示詳細日誌輸出。
*   **`-h, --help`**: 顯示幫助訊息。

## 🔑 身份驗證 (Cookie)

部分功能 (如下載某些受限影片或獲取完整的用戶列表) 可能需要登入狀態。使用 `dydl login` 命令登入後，Cookie 會被儲存。工具在執行需要驗證的操作時會自動載入儲存的 Cookie。您可以使用 `dydl check` 來確認 Cookie 的有效性。

Cookie 預設儲存路徑會根據您的作業系統而有所不同 (通常在用戶設定或應用程式資料目錄下)。

## 📄 授權條款

本專案採用 [MIT](LICENSE) 授權條款。

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request。

---

**免責聲明**: 本工具僅供學習和技術研究使用，請勿用於非法用途或侵犯版權。下載的內容版權歸原作者所有。