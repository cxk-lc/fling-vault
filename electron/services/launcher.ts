import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { findEntry, getSettings, patchEntry } from './library';
import { log } from './logger';

const children = new Map<number, number>();

/** 修改器 exe 带 requireAdministrator 清单，非提权启动会失败。 */
export class ElevationRequiredError extends Error {
  readonly code = 'ELEVATION_REQUIRED';
  constructor() {
    super('该修改器需要管理员权限才能启动');
  }
}

/** 用户在 UAC 弹窗上点了「否」，或授权请求超时。 */
export class ElevationCanceledError extends Error {
  readonly code = 'ELEVATION_CANCELED';
  constructor() {
    super('已取消管理员授权，修改器未启动');
  }
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function encodePowerShell(script: string): string {
  // -EncodedCommand 走 UTF-16LE，彻底规避中文路径与引号的转义问题
  return Buffer.from(script, 'utf16le').toString('base64');
}

interface PowerShellResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

function runPowerShell(script: string, timeoutMs: number): Promise<PowerShellResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', encodePowerShell(script)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      reject(new Error('等待管理员授权超时（180 秒）'));
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

interface LaunchOutcome {
  pid?: number;
  elevated: boolean;
  running: boolean;
  method: 'direct' | 'powershell';
  exitCode?: number;
  windowTitle?: string;
}

/**
 * 提权启动并等待真实结果：
 * - `-PassThru` 只在 UAC 通过后才返回进程对象，因此能拿到真实 PID；
 * - 授权被拒 → PowerShell 抛错、退出码非 0，这里转成 ElevationCanceledError；
 * - 启动后观察 6 秒：进程秒退时带回退出码，避免「报成功但没窗口」。
 */
async function launchElevated(filePath: string, cwd: string): Promise<LaunchOutcome> {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    'try {',
    `  $p = Start-Process -FilePath ${psQuote(filePath)} -WorkingDirectory ${psQuote(cwd)} -Verb RunAs -PassThru`,
    '} catch {',
    "  $h = $_.Exception.HResult",
    "  $native = ''",
    '  if ($_.Exception.InnerException) { $native = $_.Exception.InnerException.NativeErrorCode }',
    "  $msg = ($_.Exception.Message -replace \"`r?`n\", ' ')",
    "  Write-Output ('ERROR:' + $h + ':' + $native + ':' + $msg)",
    '  exit 0',
    '}',
    "$title = ''",
    '$deadline = (Get-Date).AddSeconds(6)',
    'while ((Get-Date) -lt $deadline -and -not $p.HasExited) {',
    '  Start-Sleep -Milliseconds 200',
    '  $p.Refresh()',
    '  if ($p.MainWindowHandle -ne 0) { $title = $p.MainWindowTitle }',
    '}',
    '$p.Refresh()',
    "if ($p.HasExited) { Write-Output ('EXITED:' + $p.Id + ':' + $p.ExitCode + ':' + $title) } else { Write-Output ('RUNNING:' + $p.Id + ':' + $title) }",
  ].join('\n');

  const { stdout, stderr, code } = await runPowerShell(script, 180_000);
  log('launch', 'powershell-result', {
    code,
    stdout: stdout.trim(),
    stderr: stderr.trim().slice(0, 200),
  });

  // UAC 被拒：PowerShell 会抛 Win32Exception，HResult=0x800704C7 / NativeErrorCode=1223。
  // 不依赖本地化文案，避免中英文系统判断失效。
  const failure = stdout.match(/ERROR:(-?\d+):(\d*):(.*)/);
  if (failure) {
    const [, hresult, native, message] = failure;
    if (hresult === '-2147023673' || native === '1223') throw new ElevationCanceledError();
    throw new Error(`提权启动失败：${message.trim() || `HResult ${hresult}`}`);
  }

  if (code !== 0) {
    const detail = stderr.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? `PowerShell 退出码 ${code}`;
    throw new Error(`提权启动失败：${detail.replace(/<[^>]+>/g, '').slice(0, 120)}`);
  }

  const running = stdout.match(/RUNNING:(\d+)(?::(.*))?/);
  if (running) {
    return {
      pid: Number(running[1]),
      elevated: true,
      running: true,
      method: 'powershell',
      windowTitle: running[2]?.trim() || undefined,
    };
  }
  const exited = stdout.match(/EXITED:(\d+):(-?\d+)(?::(.*))?/);
  if (exited) {
    return {
      pid: Number(exited[1]),
      elevated: true,
      running: false,
      method: 'powershell',
      exitCode: Number(exited[2]),
      windowTitle: exited[3]?.trim() || undefined,
    };
  }
  throw new Error('提权命令未返回进程信息');
}

/** 直接 spawn；失败时区分「需要提权」与其他错误。 */
async function launchDirect(filePath: string, cwd: string): Promise<LaunchOutcome> {
  const child = spawn(filePath, [], {
    cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });

  await new Promise<void>((resolve, reject) => {
    child.once('spawn', () => resolve());
    child.once('error', (error: NodeJS.ErrnoException) => reject(error));
  });
  child.unref();
  return { pid: child.pid, elevated: false, running: true, method: 'direct' };
}

export async function launchTrainer(
  id: number,
  asAdminOverride?: boolean,
): Promise<{ pid?: number; elevated: boolean; fallback?: boolean }> {
  const entry = findEntry(id);
  if (!entry) throw new Error('该修改器尚未安装');
  if (!existsSync(entry.filePath)) throw new Error('修改器文件已丢失，请重新下载');

  const asAdmin = asAdminOverride ?? getSettings().launchAsAdmin;
  const cwd = path.dirname(entry.filePath);
  log('launch', 'begin', { id, asAdmin, file: entry.filePath });

  let outcome: LaunchOutcome;
  if (asAdmin) {
    outcome = await launchElevated(entry.filePath, cwd);
  } else {
    try {
      outcome = await launchDirect(entry.filePath, cwd);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      // WinError 740 = ERROR_ELEVATION_REQUIRED；Node 在 Windows 上通常报 EACCES / UNKNOWN
      if (err.code === 'EACCES' || err.code === 'EPERM' || /740|elevation/i.test(err.message ?? '')) {
        throw new ElevationRequiredError();
      }
      throw error;
    }
  }

  if (!outcome.running) {
    const code = outcome.exitCode ?? 0;
    const hex = `0x${(code >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
    log('launch', 'exited-immediately', { code, hex, windowTitle: outcome.windowTitle });
    throw new Error(`修改器启动后立即退出（退出码 ${hex}）`);
  }

  if (outcome.pid) children.set(id, outcome.pid);
  const current = findEntry(id);
  patchEntry(id, { lastLaunchedAt: Date.now(), launchCount: (current?.launchCount ?? 0) + 1 });
  log('launch', 'ok', { method: outcome.method, pid: outcome.pid, windowTitle: outcome.windowTitle });

  return { pid: outcome.pid, elevated: outcome.elevated };
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
