import { existsSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import type { CatalogEntry, DownloadProgress, LibraryEntry } from '../shared/types';
import { downloadToFile } from './http';
import { fetchDetail, guessVersion, invalidateDetail } from './site';
import { findEntry, getSettings, patchEntry, upsertEntry } from './library';
import { ensureDir, tempDir } from './paths';

const active = new Map<number, AbortController>();

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
}

export function cancelDownload(id: number): boolean {
  const controller = active.get(id);
  if (!controller) return false;
  controller.abort();
  return true;
}

export function isDownloading(id: number): boolean {
  return active.has(id);
}

export interface InstallResult {
  entry: LibraryEntry;
}

/**
 * 下载 + 安装：官网 /downloads/<token> 会 302 到实际的 .exe 文件。
 * 先写 .part 再重命名，避免半截文件被误判为可用。
 */
export async function installTrainer(
  catalogEntry: CatalogEntry,
  emit: (progress: DownloadProgress) => void,
): Promise<InstallResult> {
  if (active.has(catalogEntry.id)) {
    throw new Error('该修改器正在下载中');
  }
  const settings = getSettings();
  const controller = new AbortController();
  active.set(catalogEntry.id, controller);

  const base: DownloadProgress = {
    id: catalogEntry.id,
    slug: catalogEntry.slug,
    title: catalogEntry.title,
    received: 0,
    total: 0,
    percent: 0,
    speed: 0,
    state: 'preparing',
  };
  emit(base);

  try {
    invalidateDetail(catalogEntry.id);
    const detail = await fetchDetail(catalogEntry.siteUrl, catalogEntry.id);
    const info = detail.info;
    if (!info) throw new Error('未在详情页找到下载链接，站点结构可能已变更');

    const dir = ensureDir(path.join(settings.downloadDir, catalogEntry.slug));
    const fileName = `${sanitizeFileName(info.fileName)}.exe`;
    const finalPath = path.join(dir, fileName);
    const partPath = path.join(tempDir(), `${catalogEntry.slug}-${Date.now()}.part`);

    let lastTick = Date.now();
    let lastBytes = 0;
    let speed = 0;

    emit({ ...base, state: 'downloading', total: info.fileSizeBytes });

    const { bytes } = await downloadToFile({
      url: info.token,
      targetPath: partPath,
      referer: catalogEntry.siteUrl,
      signal: controller.signal,
      onProgress: (received, total) => {
        const now = Date.now();
        if (now - lastTick > 240) {
          speed = ((received - lastBytes) * 1000) / (now - lastTick);
          lastTick = now;
          lastBytes = received;
        }
        emit({
          ...base,
          state: 'downloading',
          received,
          total: total || info.fileSizeBytes,
          percent: total > 0 ? Math.min(99, (received / total) * 100) : 0,
          speed,
        });
      },
    });

    if (existsSync(finalPath)) rmSync(finalPath, { force: true });
    renameSync(partPath, finalPath);

    emit({ ...base, state: 'installing', received: bytes, total: bytes, percent: 100 });

    const previous = findEntry(catalogEntry.id);
    const entry: LibraryEntry = {
      id: catalogEntry.id,
      slug: catalogEntry.slug,
      title: catalogEntry.title,
      siteUrl: catalogEntry.siteUrl,
      cover: catalogEntry.cover,
      coverThumb: catalogEntry.coverThumb,
      optionCount: catalogEntry.optionCount,
      gameVersion: catalogEntry.gameVersion,
      lastUpdated: catalogEntry.lastUpdated,
      postModified: catalogEntry.postModified,
      version: guessVersion(info.fileName),
      fileName,
      filePath: finalPath,
      fileSize: statSync(finalPath).size,
      remoteFileDate: info.fileDate,
      remoteFileSize: info.fileSizeBytes,
      downloadToken: info.token,
      installedAt: previous?.installedAt ?? Date.now(),
      lastLaunchedAt: previous?.lastLaunchedAt,
      launchCount: previous?.launchCount ?? 0,
      favorite: previous?.favorite ?? false,
      tags: previous?.tags ?? [],
      note: previous?.note,
      updateAvailable: false,
      updateCheckedAt: Date.now(),
      optionKeys: detail.options,
    };

    upsertEntry(entry);
    emit({ ...base, state: 'done', received: bytes, total: bytes, percent: 100, speed: 0 });
    return { entry };
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError' || controller.signal.aborted;
    emit({
      ...base,
      state: aborted ? 'canceled' : 'error',
      message: aborted ? '已取消' : (error as Error)?.message ?? '未知错误',
    });
    throw error;
  } finally {
    active.delete(catalogEntry.id);
  }
}

export async function refreshUpdate(id: number): Promise<LibraryEntry | undefined> {
  const entry = findEntry(id);
  if (!entry) return undefined;
  invalidateDetail(id);
  return patchEntry(id, { updateCheckedAt: Date.now() });
}
