import { createWriteStream, unlinkSync } from 'node:fs';
import { MAX_RETRY, REQUEST_TIMEOUT, USER_AGENT } from '../shared/constants';

export interface FetchTextResult {
  body: string;
  headers: Headers;
  status: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function headersFor(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
    Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    Referer: 'https://flingtrainer.com/',
    ...extra,
  };
}

/** 带超时、重试、退避的文本请求。 */
export async function fetchText(url: string, extraHeaders: Record<string, string> = {}): Promise<FetchTextResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(url, {
        headers: headersFor(extraHeaders),
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const body = await response.text();
      return { body, headers: response.headers, status: response.status };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRY) {
        await sleep(400 * attempt * attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`请求失败：${url} — ${(lastError as Error)?.message ?? '未知错误'}`);
}

export async function fetchJson<T>(url: string): Promise<{ data: T; headers: Headers }> {
  const { body, headers } = await fetchText(url, { Accept: 'application/json' });
  return { data: JSON.parse(body) as T, headers };
}

export interface DownloadOptions {
  url: string;
  targetPath: string;
  referer?: string;
  onProgress?: (received: number, total: number) => void;
  signal?: AbortSignal;
}

/** 流式下载，返回实际字节数。失败时清理半截文件。 */
export async function downloadToFile(options: DownloadOptions): Promise<{ bytes: number; total: number }> {
  const { url, targetPath, referer, onProgress, signal } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);

  try {
    const response = await fetch(url, {
      headers: headersFor(referer ? { Referer: referer } : {}),
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`下载失败 HTTP ${response.status}`);
    }
    const total = Number(response.headers.get('content-length') ?? 0);
    const stream = createWriteStream(targetPath);
    const reader = response.body.getReader();
    let received = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        const ok = stream.write(Buffer.from(value));
        if (!ok) {
          await new Promise<void>((resolve) => stream.once('drain', () => resolve()));
        }
        onProgress?.(received, total);
      }
    }
    await new Promise<void>((resolve, reject) => {
      stream.end(() => resolve());
      stream.on('error', reject);
    });
    return { bytes: received, total };
  } catch (error) {
    try {
      unlinkSync(targetPath);
    } catch {
      /* 文件可能尚未创建 */
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
