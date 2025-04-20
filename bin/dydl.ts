#!/usr/bin/env node

import { runCli } from '../src/cli';
// Logger level setting is now handled inside the Logger constructor

// 運行 CLI 程序
(async () => {
  try {
    await runCli();
  } catch (error) {
    console.error('CLI 執行錯誤:', error); // Keep error logging
    process.exit(1);
  }
  // No finally block needed as logger level doesn't need explicit restoration for process exit
})();
