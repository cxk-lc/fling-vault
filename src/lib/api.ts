import type {
  AppStats,
  CatalogEntry,
  CheckResult,
  DownloadProgress,
  LibraryEntry,
  Settings,
} from '@shared/types';

export interface DetailPayload {
  info: {
    token: string;
    fileName: string;
    fileDate: string;
    fileSize: string;
    fileSizeBytes: number;
  } | null;
  options: { key: string; name: string }[];
}

export interface VaultApi {
  catalog: {
    list: () => Promise<{ entries: CatalogEntry[]; updatedAt: number }>;
    sync: () => Promise<{ total: number; fetched: number; updatedAt: number }>;
    detail: (entry: CatalogEntry) => Promise<DetailPayload>;
  };
  library: {
    list: () => Promise<LibraryEntry[]>;
    patch: (id: number, patch: Record<string, unknown>) => Promise<LibraryEntry>;
    remove: (id: number) => Promise<boolean>;
  };
  download: {
    start: (entry: CatalogEntry) => Promise<LibraryEntry>;
    cancel: (id: number) => Promise<boolean>;
  };
  trainer: {
    launch: (id: number) => Promise<{ pid?: number; elevated: boolean; fallback?: boolean }>;
    checkUpdates: () => Promise<CheckResult>;
  };
  settings: {
    get: () => Promise<Settings>;
    set: (patch: Partial<Settings>) => Promise<Settings>;
    pickFolder: () => Promise<string | null>;
  };
  system: {
    stats: () => Promise<AppStats>;
    togglePanel: () => Promise<void>;
    hidePanel: () => Promise<void>;
    reveal: (target: string) => Promise<void>;
    openSite: (url: string) => Promise<void>;
  };
  on: {
    download: (handler: (progress: DownloadProgress) => void) => () => void;
    sync: (handler: (state: { done: number; total: number }) => void) => () => void;
    library: (handler: () => void) => () => void;
    quickToggle: (handler: () => void) => () => void;
  };
}

declare global {
  interface Window {
    vault: VaultApi;
  }
}

export const api = (): VaultApi => window.vault;
