import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { findEntry, getSettings, patchEntry } from './library';

const children = new Map<number, number>();

/** 修改器 exe 带 requireAdministrator 清单，非提权启动会失败。 */
export class ElevationRequiredError extends Error {
  readonly code = 'ELEVATION_REQUIRED';
  constructor() {
    super('该修改器需要管理员权限才能启动');
  }
}

function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** spawn 的失败是异步事件，必须等到 spawn / error 才知道是否成功。 */
function spawnAndWait(file: string, args: string[], options: Parameters<typeof spawn>[2]): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, options);
    const timer = setTimeout(() => {
      cleanup();
      resolve(child);
    }, 4000);
    const onSpawn = () => {
      cleanup();
      resolve(child);
    };
    const onError = (error: NodeJS.ErrnoException) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.off('spawn', onSpawn);
      child.off('error', onError);
    };
    child.once('spawn', onSpawn);
    child.once('error', onError);
  });
}

/**
 * 启动修改器。admin=true 走 PowerShell Start-Process -Verb RunAs（会弹 UAC）。
 * 非提权启动失败且原因是权限时，抛出 ElevationRequiredError 交由上层决定是否重试。
 */
export async function launchTrainer(
  id: number,
  asAdminOverride?: boolean,
): Promise<{ pid?: number; elevated: boolean; fallback?: boolean }> {
  const entry = findEntry(id);
  if (!entry) throw new Error('该修改器尚未安装');
  if (!existsSync(entry.filePath)) throw new Error('修改器文件已丢失，请重新下载');

  const asAdmin = asAdminOverride ?? getSettings().launchAsAdmin;
  const cwd = path.dirname(entry.filePath);

  if (asAdmin) {
    const command = `Start-Process -FilePath ${quotePowerShell(entry.filePath)} -WorkingDirectory ${quotePowerShell(
      cwd,
    )} -Verb RunAs`;
    const child = await spawnAndWait(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { detached: true, stdio: 'ignore', windowsHide: true },
    );
    child.unref();
    if (child.pid) children.set(id, child.pid);
    markLaunched(id);
    return { elevated: true, pid: child.pid };
  }

  try {
    const child = await spawnAndWait(entry.filePath, [], {
      cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();
    if (child.pid) children.set(id, child.pid);
    markLaunched(id);
    return { elevated: false, pid: child.pid };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    // WinError 740 = ERROR_ELEVATION_REQUIRED；Node 在 Windows 上通常报 EACCES / UNKNOWN
    if (err.code === 'EACCES' || err.code === 'EPERM' || /740|elevation/i.test(err.message ?? '')) {
      throw new ElevationRequiredError();
    }
    throw error;
  }
}

function markLaunched(id: number): void {
  const entry = findEntry(id);
  patchEntry(id, { lastLaunchedAt: Date.now(), launchCount: (entry?.launchCount ?? 0) + 1 });
}

export function isTrainerRunning(id: number): boolean {
  const pid = children.get(id);
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    children.delete(id);
    return false;
  }
}
