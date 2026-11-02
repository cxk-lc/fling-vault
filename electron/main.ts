import './boot';
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  shell,
  Tray,
} from 'electron';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { IPC } from './shared/constants';
import type { CatalogEntry, DownloadProgress, Settings } from './shared/types';
import {
  appStats,
  checkUpdates,
  getCatalog,
  getLibrary,
  getSettings,
  patchEntry,
  removeEntry,
  revealTarget,
  setSettings,
  syncCatalog,
} from './services/library';
import { cancelDownload, installTrainer } from './services/installer';
import { ElevationRequiredError, launchTrainer } from './services/launcher';
import { fetchDetail } from './services/site';
import { log } from './services/logger';

app.setName('FLiNG Vault');

// 自定义协议：打包后必须走 app://，否则 file:// 下的 ES module 会被 CORS 拦截
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let panelWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

function rendererUrl(hash = ''): string {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) return `${devUrl}${hash}`;
  return `app://bundle/index.html${hash}`;
}

function registerAppProtocol(): void {
  protocol.handle('app', (request) => {
    try {
      const url = new URL(request.url);
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file = path.join(app.getAppPath(), 'dist', relative || 'index.html');
      // pathToFileURL 处理中文/空格路径，net.fetch 能直接读 asar 内部文件
      return net.fetch(pathToFileURL(file).toString());
    } catch (error) {
      log('protocol', '解析失败', String(error));
      return new Response('Not found', { status: 404 });
    }
  });
}

function iconPath(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'build', 'icon.png'),
    path.join(app.getAppPath(), 'build', 'icon.png'),
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#1E2021',
    show: false,
    title: 'FLiNG Vault',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#17191A',
      symbolColor: '#B4B6B7',
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(rendererUrl());
  log('window', 'construct', rendererUrl());
  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    log('window', 'did-fail-load', code, desc, url);
    mainWindow?.show();
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log('window', 'render-process-gone', details.reason);
  });
  mainWindow.once('ready-to-show', () => {
    log('window', 'ready-to-show');
    mainWindow?.show();
  });
  // 兜底：即便 ready-to-show 未触发，也不让主窗口永久隐藏
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
  }, 4000);

  mainWindow.on('close', (event) => {
    if (!quitting && getSettings().closeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        mainWindow?.webContents.toggleDevTools();
      }
    });
  }
}

function createPanelWindow(): void {
  panelWindow = new BrowserWindow({
    width: 780,
    height: 560,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  panelWindow.loadURL(rendererUrl('#/quick'));
  panelWindow.on('blur', () => panelWindow?.hide());
  panelWindow.on('closed', () => {
    panelWindow = null;
  });
}

function togglePanel(): void {
  if (!panelWindow) createPanelWindow();
  if (!panelWindow) return;
  if (panelWindow.isVisible()) {
    panelWindow.hide();
    return;
  }
  panelWindow.center();
  panelWindow.show();
  panelWindow.focus();
  panelWindow.webContents.send(IPC.eventQuickToggle);
}

function send(channel: string, payload?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function registerHotkey(hotkey: string): boolean {
  globalShortcut.unregisterAll();
  try {
    return globalShortcut.register(hotkey, () => togglePanel());
  } catch (error) {
    console.warn('[hotkey] 注册失败', error);
    return false;
  }
}

function recentItems(limit = 5) {
  return getLibrary()
    .slice()
    .sort((a, b) => (b.lastLaunchedAt ?? 0) - (a.lastLaunchedAt ?? 0))
    .slice(0, limit);
}

function buildTray(): void {
  const icon = iconPath();
  tray = new Tray(icon ? nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }) : nativeImage.createEmpty());
  tray.setToolTip('FLiNG Vault — 风灵月影修改器库');
  const menu = Menu.buildFromTemplate([
    {
      label: '打开 FLiNG Vault',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { label: '快捷启动面板  Ctrl+Alt+F', click: () => togglePanel() },
    { type: 'separator' },
    ...recentItems(4).map((item) => ({
      label: `启动 · ${item.title}`,
      click: () => {
        launchTrainer(item.id).catch((error) => {
          dialog.showErrorBox('启动失败', String(error?.message ?? error));
        });
      },
    })),
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function registerIpc(): void {
  ipcMain.handle(IPC.catalogList, () => getCatalog());

  ipcMain.handle(IPC.catalogSync, async () => {
    const result = await syncCatalog((done, total) => send(IPC.eventSync, { done, total }));
    send(IPC.eventLibrary);
    return result;
  });

  ipcMain.handle(IPC.catalogDetail, async (_event, entry: CatalogEntry) => {
    const detail = await fetchDetail(entry.siteUrl, entry.id);
    return detail;
  });

  ipcMain.handle(IPC.libraryList, () => getLibrary());

  ipcMain.handle(IPC.downloadStart, async (_event, entry: CatalogEntry) => {
    const result = await installTrainer(entry, (progress: DownloadProgress) => {
      send(IPC.eventDownload, progress);
    });
    send(IPC.eventLibrary);
    return result.entry;
  });

  ipcMain.handle(IPC.downloadCancel, (_event, id: number) => cancelDownload(id));

  ipcMain.handle(IPC.trainerLaunch, async (_event, id: number) => {
    try {
      return await launchTrainer(id);
    } catch (error) {
      if (error instanceof ElevationRequiredError) {
        const result = await launchTrainer(id, true);
        return { ...result, fallback: true };
      }
      throw error;
    }
  });

  ipcMain.handle(IPC.trainerRemove, (_event, id: number) => {
    const ok = removeEntry(id);
    send(IPC.eventLibrary);
    return ok;
  });

  ipcMain.handle(IPC.trainerPatch, (_event, id: number, patch: Record<string, unknown>) => {
    const result = patchEntry(id, patch);
    send(IPC.eventLibrary);
    return result;
  });

  ipcMain.handle(IPC.updatesCheck, async () => {
    const result = await checkUpdates();
    send(IPC.eventLibrary);
    return result;
  });

  ipcMain.handle(IPC.stats, () => appStats());

  ipcMain.handle(IPC.settingsGet, () => getSettings());

  ipcMain.handle(IPC.settingsSet, (_event, patch: Partial<Settings>) => {
    const next = setSettings(patch);
    if (patch.hotkey) registerHotkey(next.hotkey);
    return next;
  });

  ipcMain.handle(IPC.panelToggle, () => togglePanel());
  ipcMain.handle(IPC.panelHide, () => panelWindow?.hide());

  ipcMain.handle(IPC.shellReveal, (_event, target: string) => {
    const resolved = revealTarget(target);
    shell.showItemInFolder(resolved);
  });

  ipcMain.handle(IPC.shellOpenSite, (_event, url: string) => shell.openExternal(url));

  ipcMain.handle(IPC.pickFolder, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  app.whenReady().then(() => {
    log('app', 'ready', { packaged: app.isPackaged, appPath: app.getAppPath() });
    registerAppProtocol();
    Menu.setApplicationMenu(null);
    registerIpc();
    createMainWindow();
    createPanelWindow();
    buildTray();
    registerHotkey(getSettings().hotkey);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
      mainWindow?.show();
    });
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
