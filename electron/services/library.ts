import { app } from 'electron';
import { existsSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import type { CatalogEntry, LibraryEntry, Settings } from '../shared/types';
import { DEFAULT_HOTKEY } from '../shared/constants';
import { JsonStore } from './store';
import { defaultLibraryDir, ensureDir } from './paths';
import { fetchCatalog, fetchPostsByIds } from './site';

interface LibraryFile {
  items: LibraryEntry[];
}

interface CatalogFile {
  entries: CatalogEntry[];
  updatedAt: number;
}

// 惰性初始化：store 的落盘路径依赖 app.getPath('userData')，
// 必须等 app.setName / ready 之后再取，避免在模块导入期固化。
let settingsRef: JsonStore<Settings> | null = null;
let libraryRef: JsonStore<LibraryFile> | null = null;
let catalogRef: JsonStore<CatalogFile> | null = null;

const settingsStore = (): JsonStore<Settings> =>
  (settingsRef ??= new JsonStore<Settings>('settings.json', {
    downloadDir: '',
    launchAsAdmin: true,
    closeToTray: true,
    hotkey: DEFAULT_HOTKEY,
    autoCheckUpdates: true,
    lastSyncAt: 0,
  }));

const libraryStore = (): JsonStore<LibraryFile> =>
  (libraryRef ??= new JsonStore<LibraryFile>('library.json', { items: [] }));

const catalogStore = (): JsonStore<CatalogFile> =>
  (catalogRef ??= new JsonStore<CatalogFile>('catalog.json', { entries: [], updatedAt: 0 }));

export function getSettings(): Settings {
  const store = settingsStore();
  const settings = store.read();
  if (!settings.downloadDir) {
    settings.downloadDir = defaultLibraryDir();
    store.write(settings);
  }
  ensureDir(settings.downloadDir);
  return settings;
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  if (next.downloadDir) ensureDir(next.downloadDir);
  return settingsStore().write(next);
}

export function getLibrary(): LibraryEntry[] {
  return libraryStore().read().items;
}

export function findEntry(id: number): LibraryEntry | undefined {
  return getLibrary().find((item) => item.id === id);
}

export function upsertEntry(entry: LibraryEntry): LibraryEntry {
  const file = libraryStore().read();
  const index = file.items.findIndex((item) => item.id === entry.id);
  if (index >= 0) file.items[index] = entry;
  else file.items.push(entry);
  libraryStore().write(file);
  return entry;
}

export function patchEntry(id: number, patch: Partial<LibraryEntry>): LibraryEntry | undefined {
  const file = libraryStore().read();
  const index = file.items.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  file.items[index] = { ...file.items[index], ...patch };
  libraryStore().write(file);
  return file.items[index];
}

export function removeEntry(id: number): boolean {
  const file = libraryStore().read();
  const target = file.items.find((item) => item.id === id);
  if (!target) return false;
  file.items = file.items.filter((item) => item.id !== id);
  libraryStore().write(file);
  try {
    if (existsSync(target.filePath)) {
      rmSync(target.filePath, { force: true });
    }
    const parent = path.dirname(target.filePath);
    const root = getSettings().downloadDir;
    if (parent.startsWith(root) && parent !== root && existsSync(parent)) {
      rmSync(parent, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn('[library] 删除文件失败', error);
  }
  return true;
}

export function getCatalog(): { entries: CatalogEntry[]; updatedAt: number } {
  return catalogStore().read();
}

export async function syncCatalog(onProgress?: (done: number, total: number) => void) {
  const result = await fetchCatalog(onProgress);
  const updatedAt = Date.now();
  catalogStore().write({ entries: result.entries, updatedAt });
  setSettings({ lastSyncAt: updatedAt });
  return { total: result.total, fetched: result.entries.length, updatedAt };
}

export async function checkUpdates(): Promise<{ checked: number; updates: number }> {
  const items = getLibrary();
  if (items.length === 0) return { checked: 0, updates: 0 };
  const remote = await fetchPostsByIds(items.map((item) => item.id));
  const byId = new Map(remote.map((entry) => [entry.id, entry]));
  let updates = 0;
  const now = Date.now();
  const file = libraryStore().read();
  for (const item of file.items) {
    const latest = byId.get(item.id);
    if (!latest) continue;
    const changed = latest.lastUpdated !== item.lastUpdated || latest.postModified !== item.postModified;
    item.updateAvailable = changed;
    item.updateCheckedAt = now;
    item.optionCount = latest.optionCount || item.optionCount;
    item.gameVersion = latest.gameVersion || item.gameVersion;
    item.cover = latest.cover ?? item.cover;
    item.postModified = latest.postModified;
    if (changed) updates += 1;
  }
  libraryStore().write(file);
  return { checked: file.items.length, updates };
}

export function appStats() {
  const items = getLibrary();
  const catalog = getCatalog();
  const diskUsage = items.reduce((sum, item) => {
    try {
      return sum + (existsSync(item.filePath) ? statSync(item.filePath).size : 0);
    } catch {
      return sum;
    }
  }, 0);
  return {
    installed: items.length,
    updates: items.filter((item) => item.updateAvailable).length,
    catalogTotal: catalog.entries.length,
    diskUsage,
    lastSyncAt: catalog.updatedAt,
  };
}

export function revealTarget(filePath: string): string {
  if (existsSync(filePath)) return filePath;
  const settings = getSettings();
  return existsSync(settings.downloadDir) ? settings.downloadDir : app.getPath('downloads');
}
