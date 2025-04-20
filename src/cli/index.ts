/**
 * CLI 模組
 * 提供命令行界面的實現
 */

import { Command } from 'commander';
// 使用動態導入代替靜態導入
// import chalk from 'chalk';
// Import rootLogger and LogLevel for potential global level setting
import { cliLogger as logger, rootLogger, LogLevel } from '../utils/logger';
import { getVersion } from './utils';

// 導入各個命令
import { registerLoginCommand } from './commands/login';
import { registerCheckCommand } from './commands/check';
import { registerVideoCommand } from './commands/video';
import { registerOpenCommand } from './commands/open'; // Import the new command
import { registerInfoCommand } from './commands/info'; // Import the info command
import { registerListCommand } from './commands/list'; // Import the list command

/**
 * 創建 CLI 程序
 * @returns Promise<Command> 命令行程序實例
 */
export async function createCli(): Promise<Command> {
  // 動態導入 chalk
  const { default: chalk } = await import('chalk');

  const program = new Command();

  // 設定基本信息
  program
    .name('dydl')
    .description('抖音影片解析與下載工具')
    .version(getVersion());

  // 註冊各個命令
  registerLoginCommand(program);
  registerCheckCommand(program);
  registerVideoCommand(program);
  registerOpenCommand(program); // Register the new command
  registerInfoCommand(program); // Register the info command
  registerListCommand(program); // Register the list command

  // 添加全局選項
  program
    .option('-v, --verbose', '顯示詳細日誌')
    .on('option:verbose', () => {
      process.env.VERBOSE = 'true';
      logger.debug('已啟用詳細日誌輸出');
    });

  // 自定義幫助信息
  program.addHelpText('after', `
範例:
  $ dydl login                      # 登入抖音並儲存 Cookie
  $ dydl check                      # 檢查已儲存的 Cookie 是否有效
  $ dydl open                       # 打開已載入 Cookie 的瀏覽器
  $ dydl video <影片連結>             # 下載單個影片
  $ dydl video -d ./videos <連結>    # 指定下載目錄 (注意: 已改為 -d)
  $ dydl video -f video.mp4 <連結>   # 指定單個影片的輸出檔案
  $ dydl info <影片連結>              # 獲取影片資訊並輸出到控制台
  $ dydl info -f info.json <連結>    # 獲取影片資訊並輸出到檔案
  $ dydl list <用戶頁面連結>          # 獲取用戶所有影片列表並輸出到控制台
  $ dydl list -n 10 <用戶頁面連結>   # 獲取用戶最新的 10 個影片列表
  $ dydl list -f list.json <用戶頁面連結> # 獲取用戶影片列表並輸出到檔案
  $ dydl video --help               # 顯示 video 命令的詳細幫助

  更多信息請訪問: https://github.com/gkctou/douyin-downloader
`);

  // 處理未知命令
  program.on('command:*', async (operands) => {
    // 動態導入 chalk (在事件處理程序中)
    const { default: chalk } = await import('chalk');

    console.error(chalk.red(`錯誤: 未知命令 '${operands[0]}'`));
    console.error();
    console.error(`請執行 ${chalk.yellow('dydl --help')} 查看可用命令`);
    process.exitCode = 1;
  });

  return program;
}

/**
 * 運行 CLI 程序
 * @param args 命令行參數
 */
export async function runCli(args: string[] = process.argv): Promise<void> {
  // Removed console override variables and logic from here

  try {
    // Removed pre-check for silent mode

    const program = await createCli();

    // 解析命令行參數並執行命令
    program.parse(args);

    // 如果沒有提供命令，顯示幫助信息
    if (process.argv.length <= 2) {
      program.outputHelp();
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('CLI 運行錯誤:', err); // 這個錯誤應該總是顯示
    process.exitCode = 1;
  }
  // Removed finally block for console restore
}