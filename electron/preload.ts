import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from './shared/constants';
import type { CatalogEntry, DownloadProgress, LaunchResult, Settings } from './shared/types';

const api = {
  catalog: {
    list: () => ipcRenderer.invoke(IPC.catalogList),
    sync: () => ipcRenderer.invoke(IPC.catalogSync),
    detail: (entry: CatalogEntry) => ipcRenderer.invoke(IPC.catalogDetail, entry),
  },
  library: {
    list: () => ipcRenderer.invoke(IPC.libraryList),
    patch: (id: number, patch: Record<string, unknown>) => ipcRenderer.invoke(IPC.trainerPatch, id, patch),
    remove: (id: number) => ipcRenderer.invoke(IPC.trainerRemove, id),
  },
  download: {
    start: (entry: CatalogEntry) => ipcRenderer.invoke(IPC.downloadStart, entry),
    cancel: (id: number) => ipcRenderer.invoke(IPC.downloadCancel, id),
  },
  trainer: {
    launch: (id: number): Promise<LaunchResult> => ipcRenderer.invoke(IPC.trainerLaunch, id),
    checkUpdates: () => ipcRenderer.invoke(IPC.updatesCheck),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    set: (patch: Partial<Settings>) => ipcRenderer.invoke(IPC.settingsSet, patch),
    pickFolder: () => ipcRenderer.invoke(IPC.pickFolder),
  },
  system: {
    stats: () => ipcRenderer.invoke(IPC.stats),
    info: () => ipcRenderer.invoke(IPC.appInfo),
    togglePanel: () => ipcRenderer.invoke(IPC.panelToggle),
    hidePanel: () => ipcRenderer.invoke(IPC.panelHide),
    reveal: (target: string) => ipcRenderer.invoke(IPC.shellReveal, target),
    openSite: (url: string) => ipcRenderer.invoke(IPC.shellOpenSite, url),
  },
  on: {
    download: (handler: (progress: DownloadProgress) => void) => subscribe(IPC.eventDownload, handler),
    sync: (handler: (state: { done: number; total: number }) => void) => subscribe(IPC.eventSync, handler),
    library: (handler: () => void) => subscribe(IPC.eventLibrary, handler),
    quickToggle: (handler: () => void) => subscribe(IPC.eventQuickToggle, handler),
  },
};

function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('vault', api);

export type VaultApi = typeof api;
