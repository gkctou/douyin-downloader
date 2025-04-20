/**
 * 進度顯示功能
 * 提供豐富的終端進度條顯示
 */

// 使用動態導入代替靜態導入
// import chalk from 'chalk';
// import ora from 'ora';

/**
 * 進度條顯示器
 * 負責在命令行中顯示影片下載進度
 */
export class DownloadProgressDisplay {
  private spinner: any;
  private total: number;
  private completed: number;
  private progressMap: Map<number, number>;
  private startTime: number;
  private barWidth: number;
  private chalk: any;
  
  /**
   * 建立進度顯示器
   * @param spinner Ora 實例
   * @param chalk Chalk 實例
   * @param barWidth 進度條寬度
   */
  constructor(
    spinner: any, 
    chalk: any,
    barWidth: number = 30
  ) {
    this.spinner = spinner;
    this.chalk = chalk;
    this.total = 0;
    this.completed = 0;
    this.progressMap = new Map();
    this.startTime = Date.now();
    this.barWidth = barWidth;
  }
  
  /**
   * 初始化進度顯示
   * @param total 影片總數
   */
  initialize(total: number): void {
    this.total = total;
    this.completed = 0;
    this.progressMap.clear();
    this.startTime = Date.now();
    
    this.updateDisplay();
  }
  
  /**
   * 更新特定影片的下載進度
   * @param index 影片索引 (0-based)
   * @param progress 進度百分比 (0-100)
   * @param speed 下載速度 (KB/s)
   */
  updateProgress(index: number, progress: number, speed: number = 0): void {
    this.progressMap.set(index, progress);
    this.updateDisplay(speed);
  }
  
  /**
   * 更新完成的影片數量
   * @param completed 已完成的影片數量
   */
  updateCompleted(completed: number): void {
    this.completed = completed;
    this.updateDisplay();
  }
  
  /**
   * 標記一個影片下載完成
   * @param index 影片索引 (0-based)
   */
  completeItem(index: number): void {
    this.progressMap.set(index, 100);
    this.completed++;
    this.updateDisplay();
  }
  
  /**
   * 格式化進度條
   * @param progress 進度百分比 (0-100)
   * @returns 格式化的進度條字串
   */
  private formatProgressBar(progress: number): string {
    const filled = Math.round(this.barWidth * (progress / 100));
    const empty = this.barWidth - filled;
    
    return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
  }
  
  /**
   * 計算估計剩餘時間
   * @returns 格式化的估計剩餘時間
   */
  private getEstimatedTimeRemaining(): string {
    const elapsedMs = Date.now() - this.startTime;
    if (this.completed === 0 || elapsedMs === 0) {
      return '計算中...';
    }
    
    // 計算平均每個影片的處理時間
    const avgTimePerItem = elapsedMs / this.completed;
    // 估計剩餘時間
    const remainingItems = this.total - this.completed;
    const remainingMs = avgTimePerItem * remainingItems;
    
    // 格式化時間
    if (remainingMs < 1000) {
      return '即將完成';
    } else if (remainingMs < 60000) {
      return `${Math.ceil(remainingMs / 1000)} 秒`;
    } else if (remainingMs < 3600000) {
      return `${Math.ceil(remainingMs / 60000)} 分鐘`;
    } else {
      return `${Math.floor(remainingMs / 3600000)}小時 ${Math.ceil((remainingMs % 3600000) / 60000)}分鐘`;
    }
  }
  
  /**
   * 更新顯示
   * @param speed 下載速度 (KB/s)
   */
  private updateDisplay(speed: number = 0): void {
    // 計算總體進度
    let totalProgress = 0;
    
    this.progressMap.forEach((progress) => {
      totalProgress += progress;
    });
    
    const overallProgress = this.progressMap.size > 0 
      ? Math.round(totalProgress / this.progressMap.size) 
      : 0;
    
    // 構建顯示文本
    let displayText = `[${this.completed}/${this.total}] `;
    displayText += this.formatProgressBar(overallProgress);
    displayText += ` ${overallProgress}%`;
    
    // 添加速度信息
    if (speed > 0) {
      const speedText = speed >= 1024 
        ? `${(speed / 1024).toFixed(1)} MB/s` 
        : `${Math.round(speed)} KB/s`;
      
      displayText += ` ${this.chalk.cyan(speedText)}`;
    }
    
    // 添加估計剩餘時間
    if (this.completed > 0 && this.completed < this.total) {
      displayText += ` (剩餘時間: ${this.chalk.yellow(this.getEstimatedTimeRemaining())})`;
    }
    
    // 更新 spinner 文本
    this.spinner.text = displayText;
  }
  
  /**
   * 完成下載並顯示最終結果
   * @param success 成功下載的數量
   * @param failed 失敗的數量
   */
  finalize(success: number, failed: number = 0): void {
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
    
    let message = `下載完成 (用時: ${totalTime}秒)`;
    message += `，成功: ${this.chalk.green(success)}`;
    
    if (failed > 0) {
      message += `，失敗: ${this.chalk.red(failed)}`;
    }
    
    this.spinner.succeed(message);
  }
  
  /**
   * 顯示失敗
   * @param message 失敗消息
   */
  fail(message: string): void {
    this.spinner.fail(message);
  }
}

/**
 * 創建下載進度處理器
 * @param spinner Ora 實例
 * @param message 進度消息前綴
 * @returns 進度回調函數
 */
export async function createDownloadProgressHandler(
  spinner: any,
  message: string = '下載中:'
): Promise<(current: number, total: number, progress?: number) => void> {
  // 動態導入 chalk
  const { default: chalk } = await import('chalk');
  
  const display = new DownloadProgressDisplay(spinner, chalk);
  let initialized = false;
  
  return (current: number, total: number, progress: number = 0) => {
    if (!initialized) {
      display.initialize(total);
      initialized = true;
    }
    
    display.updateCompleted(current);
    
    // 如果提供了總體進度，更新第一個影片的進度
    if (progress > 0) {
      display.updateProgress(0, progress);
    }
  };
}
