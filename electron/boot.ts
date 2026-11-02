import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 最先执行的启动标记：用于定位「打包后无窗口且无日志」这类早期失败。
 * 不依赖 electron 的 app 模块（此时可能尚不可用）。每次启动覆盖，只保留最后一条。
 */
export function bootLog(message: string): void {
  try {
    const dir = path.join(process.env.APPDATA ?? process.cwd(), 'FLiNG Vault');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'boot.log'), `${new Date().toISOString()} ${message}\n`, 'utf-8');
  } catch {
    /* ignore */
  }
}

bootLog(`bundle loaded (pid ${process.pid})`);
