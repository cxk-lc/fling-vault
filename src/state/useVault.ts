import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogEntry, CheckResult, DownloadProgress, LibraryEntry, Settings } from '@shared/types';
import { api } from '../lib/api';

export type ToastKind = 'info' | 'success' | 'error';
export interface ToastState {
  id: number;
  kind: ToastKind;
  text: string;
}

export function useVault() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogAt, setCatalogAt] = useState(0);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [downloads, setDownloads] = useState<Record<number, DownloadProgress>>({});
  const [booting, setBooting] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const notify = useCallback((text: string, kind: ToastKind = 'info') => {
    setToast({ id: Date.now(), kind, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshLibrary = useCallback(async () => {
    const items = await api().library.list();
    setLibrary(items);
  }, []);

  const refreshAll = useCallback(async () => {
    const [cat, lib, cfg] = await Promise.all([api().catalog.list(), api().library.list(), api().settings.get()]);
    setCatalog(cat.entries);
    setCatalogAt(cat.updatedAt);
    setLibrary(lib);
    setSettings(cfg);
    setBooting(false);
  }, []);

  useEffect(() => {
    refreshAll().catch((error) => {
      setBooting(false);
      notify(`初始化失败：${String(error?.message ?? error)}`, 'error');
    });

    const offLibrary = api().on.library(() => {
      refreshLibrary().catch(() => undefined);
    });
    const offDownload = api().on.download((progress) => {
      setDownloads((prev) => ({ ...prev, [progress.id]: progress }));
      if (progress.state === 'done') {
        const timer = setTimeout(() => {
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[progress.id];
            return next;
          });
        }, 2600);
        timers.current[progress.id] = timer;
      }
      if (progress.state === 'error') {
        notify(`下载失败：${progress.message ?? '未知错误'}`, 'error');
      }
      if (progress.state === 'canceled') {
        notify('已取消下载', 'info');
      }
    });
    const offSync = api().on.sync((state) => setSyncProgress(state));

    return () => {
      offLibrary();
      offDownload();
      offSync();
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, [notify, refreshAll, refreshLibrary]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncProgress({ done: 0, total: 1 });
    try {
      const result = await api().catalog.sync();
      const cat = await api().catalog.list();
      setCatalog(cat.entries);
      setCatalogAt(cat.updatedAt);
      notify(`目录已更新：${result.fetched} 个修改器`, 'success');
    } catch (error) {
      notify(`同步失败：${String((error as Error)?.message ?? error)}`, 'error');
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }, [notify]);

  const install = useCallback(
    async (entry: CatalogEntry) => {
      try {
        await api().download.start(entry);
        notify(`${entry.title} 已加入本地库`, 'success');
        await refreshLibrary();
      } catch (error) {
        const message = String((error as Error)?.message ?? error);
        if (!message.includes('aborted')) notify(`安装失败：${message}`, 'error');
      }
    },
    [notify, refreshLibrary],
  );

  const cancel = useCallback((id: number) => {
    api().download.cancel(id).catch(() => undefined);
  }, []);

  const launch = useCallback(
    async (id: number, title: string) => {
      try {
        const result = await api().trainer.launch(id);
        const mode = result.fallback ? '已提权（需要管理员权限）' : result.elevated ? '管理员模式' : '普通模式';
        notify(`已启动 ${title} · ${mode}`, 'success');
        await refreshLibrary();
      } catch (error) {
        notify(`启动失败：${String((error as Error)?.message ?? error)}`, 'error');
      }
    },
    [notify, refreshLibrary],
  );

  const remove = useCallback(
    async (id: number, title: string) => {
      try {
        await api().library.remove(id);
        notify(`已删除 ${title}`, 'success');
        await refreshLibrary();
      } catch (error) {
        notify(`删除失败：${String((error as Error)?.message ?? error)}`, 'error');
      }
    },
    [notify, refreshLibrary],
  );

  const patch = useCallback(
    async (id: number, changes: Record<string, unknown>) => {
      await api().library.patch(id, changes);
      await refreshLibrary();
    },
    [refreshLibrary],
  );

  const checkUpdates = useCallback(async (): Promise<CheckResult | null> => {
    setChecking(true);
    try {
      const result = await api().trainer.checkUpdates();
      await refreshLibrary();
      if (result.checked === 0) notify('本地库为空，先下载一个修改器吧', 'info');
      else if (result.updates === 0) notify(`已检查 ${result.checked} 个修改器，均为最新`, 'success');
      else notify(`发现 ${result.updates} 个可更新修改器`, 'info');
      return result;
    } catch (error) {
      notify(`检查更新失败：${String((error as Error)?.message ?? error)}`, 'error');
      return null;
    } finally {
      setChecking(false);
    }
  }, [notify, refreshLibrary]);

  const saveSettings = useCallback(
    async (changes: Partial<Settings>) => {
      const next = await api().settings.set(changes);
      setSettings(next);
      notify('设置已保存', 'success');
      return next;
    },
    [notify],
  );

  return {
    catalog,
    catalogAt,
    library,
    settings,
    downloads,
    booting,
    syncing,
    syncProgress,
    checking,
    toast,
    setToast,
    notify,
    sync,
    install,
    cancel,
    launch,
    remove,
    patch,
    checkUpdates,
    saveSettings,
    refreshLibrary,
    refreshAll,
  };
}
