import { app } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * 极简文件日志：打包版没有控制台，排查启动/加载问题只能靠落盘日志。
 * 位置：%APPDATA%/FLiNG Vault/logs/main.log
 */
export function log(tag: string, ...args: unknown[]): void {
  const detail = args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
  const line = `[${new Date().toISOString()}] [${tag}] ${detail}\n`;
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, 'main.log'), line, 'utf-8');
  } catch {
    /* 日志失败不应影响主流程 */
  }
  if (!app.isPackaged) {
    process.stdout.write(line);
  }
}
