/** 修改器条目（官网目录 + 本地状态的合并视图） */
export interface TrainerOption {
  key: string;
  name: string;
}

export interface CatalogEntry {
  id: number;
  slug: string;
  title: string;
  siteUrl: string;
  cover?: string;
  /** WordPress 生成的 300w 缩略图，用于卡片网格，避免每张拉 700KB 原图 */
  coverThumb?: string;
  optionCount: number;
  gameVersion: string;
  lastUpdated: string;
  postDate: string;
  postModified: string;
  keywords: string;
}

export interface LibraryEntry {
  id: number;
  slug: string;
  title: string;
  siteUrl: string;
  cover?: string;
  coverThumb?: string;
  optionCount: number;
  gameVersion: string;
  lastUpdated: string;
  postModified: string;
  /** 官网压缩包/文件名中的版本标识，如 "v1.0 Plus 36" */
  version: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  remoteFileDate?: string;
  remoteFileSize?: number;
  downloadToken?: string;
  installedAt: number;
  lastLaunchedAt?: number;
  launchCount: number;
  favorite: boolean;
  tags: string[];
  note?: string;
  updateAvailable?: boolean;
  updateCheckedAt?: number;
  optionKeys: TrainerOption[];
}

export interface Settings {
  downloadDir: string;
  launchAsAdmin: boolean;
  closeToTray: boolean;
  hotkey: string;
  autoCheckUpdates: boolean;
  lastSyncAt: number;
}

export interface DownloadProgress {
  id: number;
  slug: string;
  title: string;
  received: number;
  total: number;
  percent: number;
  speed: number;
  state: 'preparing' | 'downloading' | 'installing' | 'done' | 'error' | 'canceled';
  message?: string;
}

export interface SyncResult {
  total: number;
  fetched: number;
  updatedAt: number;
}

export interface AppStats {
  installed: number;
  updates: number;
  catalogTotal: number;
  diskUsage: number;
  lastSyncAt: number;
}

export interface ToastMessage {
  kind: 'info' | 'success' | 'error';
  text: string;
}

export interface CheckResult {
  checked: number;
  updates: number;
}
