import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogEntry, LibraryEntry } from '@shared/types';
import { api } from './lib/api';
import { formatDate, matchScore } from './lib/format';
import { useVault } from './state/useVault';
import { Rail, TitleBar, type ViewKey } from './components/Shell';
import { Toolbar, type SortKey } from './components/Toolbar';
import { TrainerCard } from './components/TrainerCard';
import { DetailDrawer, type DrawerTarget } from './components/DetailDrawer';
import { SettingsModal } from './components/SettingsModal';
import { EmptyState, Toast, Transfers } from './components/Feedback';

const VIEW_META: Record<ViewKey, { title: string; hint: string }> = {
  catalog: { title: '全部修改器', hint: '官网目录 · 点击卡片查看快捷键并下载' },
  installed: { title: '已安装', hint: '双击卡片启动，右键查看详情' },
  updates: { title: '可更新', hint: '对比官网最后更新时间得出' },
  favorites: { title: '收藏', hint: '常用修改器固定在此' },
};

function toCatalog(entry: LibraryEntry): CatalogEntry {
  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    siteUrl: entry.siteUrl,
    cover: entry.cover,
    coverThumb: entry.coverThumb,
    optionCount: entry.optionCount,
    gameVersion: entry.gameVersion,
    lastUpdated: entry.lastUpdated,
    postDate: new Date(entry.installedAt).toISOString(),
    postModified: entry.postModified,
    keywords: `${entry.title} ${entry.slug} ${entry.tags.join(' ')}`.toLowerCase(),
  };
}

export default function App() {
  const vault = useVault();
  const [view, setView] = useState<ViewKey>('catalog');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [visible, setVisible] = useState(48);
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const autoChecked = useRef(false);
  const autoSynced = useRef(false);

  const installedMap = useMemo(() => {
    const map = new Map<number, LibraryEntry>();
    vault.library.forEach((item) => map.set(item.id, item));
    return map;
  }, [vault.library]);

  const catalogMap = useMemo(() => {
    const map = new Map<number, CatalogEntry>();
    vault.catalog.forEach((item) => map.set(item.id, item));
    return map;
  }, [vault.catalog]);

  const counts = useMemo(
    () => ({
      catalog: vault.catalog.length,
      installed: vault.library.length,
      updates: vault.library.filter((item) => item.updateAvailable).length,
      favorites: vault.library.filter((item) => item.favorite).length,
    }),
    [vault.catalog.length, vault.library],
  );

  const tags = useMemo(() => {
    const map = new Map<string, number>();
    vault.library.forEach((item) => {
      item.tags.forEach((tag) => map.set(tag, (map.get(tag) ?? 0) + 1));
    });
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [vault.library]);

  const items = useMemo(() => {
    let source: { entry: CatalogEntry; installed?: LibraryEntry }[] = [];

    if (activeTag) {
      source = vault.library
        .filter((item) => item.tags.includes(activeTag))
        .map((item) => ({ entry: toCatalog(item), installed: item }));
    } else if (view === 'catalog') {
      source = vault.catalog.map((entry) => ({ entry, installed: installedMap.get(entry.id) }));
    } else {
      let list = vault.library;
      if (view === 'updates') list = list.filter((item) => item.updateAvailable);
      if (view === 'favorites') list = list.filter((item) => item.favorite);
      source = list.map((item) => ({ entry: toCatalog(item), installed: item }));
    }

    if (query.trim()) {
      source = source
        .map((item) => ({ item, score: matchScore(item.entry.keywords, query) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((row) => row.item);
    }

    if (sort === 'name') {
      source = [...source].sort((a, b) => a.entry.title.localeCompare(b.entry.title, 'zh-Hans-CN'));
    } else if (sort === 'installed') {
      source = [...source].sort((a, b) => (b.installed?.installedAt ?? 0) - (a.installed?.installedAt ?? 0));
    } else {
      source = [...source].sort((a, b) => (a.entry.lastUpdated < b.entry.lastUpdated ? 1 : -1));
    }
    return source;
  }, [activeTag, installedMap, query, sort, view, vault.catalog, vault.library]);

  useEffect(() => {
    setVisible(48);
    contentRef.current?.scrollTo({ top: 0 });
  }, [view, activeTag, query, sort]);

  useEffect(() => {
    if (vault.booting || autoSynced.current) return;
    if (vault.catalog.length > 0 || vault.syncing) return;
    autoSynced.current = true;
    vault.sync();
  }, [vault.booting, vault.catalog.length, vault.syncing, vault.sync]);

  useEffect(() => {
    if (autoChecked.current) return;
    if (!vault.settings?.autoCheckUpdates) return;
    if (vault.library.length === 0) return;
    autoChecked.current = true;
    const timer = setTimeout(() => {
      vault.checkUpdates().catch(() => undefined);
    }, 2500);
    return () => clearTimeout(timer);
  }, [vault.settings?.autoCheckUpdates, vault.library.length, vault.checkUpdates]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA'].includes(target?.tagName ?? '');
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
        else if (selectedId !== null) setSelectedId(null);
        else if (typing) target.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, settingsOpen]);

  const selected: DrawerTarget | null = useMemo(() => {
    if (selectedId === null) return null;
    const installed = installedMap.get(selectedId);
    const entry = catalogMap.get(selectedId) ?? (installed ? toCatalog(installed) : undefined);
    if (!entry) return null;
    return { entry, installed };
  }, [catalogMap, installedMap, selectedId]);

  const launch = useCallback(
    (id: number, title: string) => {
      vault.launch(id, title);
    },
    [vault],
  );

  const renderEmpty = () => {
    if (vault.booting) {
      return (
        <div className="grid">
          {Array.from({ length: 8 }).map((_v, index) => (
            <div className="skeleton-card" key={index} />
          ))}
        </div>
      );
    }
    if (vault.catalog.length === 0 && view === 'catalog' && !query) {
      return (
        <EmptyState
          mark="First run"
          title="先同步一次官网目录"
          text="从 flingtrainer.com 拉取全部修改器条目（约 700+ 个），之后可离线浏览、搜索与检查更新。"
          actionLabel={vault.syncing ? '同步中…' : '同步官网目录'}
          onAction={vault.sync}
          secondaryLabel="打开官网"
          onSecondary={() => api().system.openSite('https://flingtrainer.com/')}
        />
      );
    }
    if (query.trim()) {
      return (
        <EmptyState
          mark="No match"
          title={`没有找到「${query.trim()}」`}
          text="试试英文名或更短的关键词；官网只有英文标题。目录未同步时也会搜索不到结果。"
          actionLabel="清空搜索"
          onAction={() => setQuery('')}
        />
      );
    }
    if (view === 'installed') {
      return (
        <EmptyState
          mark="Library empty"
          title="本地库还是空的"
          text="在「全部修改器」里挑一个下载。下载后会存入本地目录，可离线启动、检测更新与删除。"
          actionLabel="浏览全部修改器"
          onAction={() => setView('catalog')}
        />
      );
    }
    if (view === 'updates') {
      return (
        <EmptyState
          mark="Up to date"
          title="没有待更新的修改器"
          text="安装后点「检查更新」会对比官网的最后更新时间；有新版本时这里会出现条目。"
          actionLabel="立即检查"
          onAction={() => vault.checkUpdates()}
        />
      );
    }
    if (view === 'favorites') {
      return (
        <EmptyState
          mark="No favorites"
          title="还没有收藏"
          text="在修改器详情里点星标即可加入收藏，之后用快捷启动面板（Ctrl+Alt+F）快速拉起。"
          actionLabel="浏览全部修改器"
          onAction={() => setView('catalog')}
        />
      );
    }
    return (
      <EmptyState
        mark="No results"
        title="这个分类下还没有内容"
        text="在修改器详情里添加标签后，会在这里按分类聚合。"
      />
    );
  };

  const meta = VIEW_META[view];
  const remaining = items.length - visible;

  return (
    <div className="shell">
      <TitleBar
        syncLabel={vault.catalogAt ? `目录更新于 ${formatDate(vault.catalogAt)}` : '目录未同步'}
        onQuickLaunch={() => api().system.togglePanel()}
      />

      <Rail
        view={view}
        counts={counts}
        tags={tags}
        activeTag={activeTag}
        onView={setView}
        onTag={(tag) => {
          setActiveTag(tag);
          if (tag) setView('installed');
        }}
        onSettings={() => setSettingsOpen(true)}
        onSite={() => api().system.openSite('https://flingtrainer.com/')}
      />

      <main className="main">
        <Toolbar
          query={query}
          onQuery={setQuery}
          sort={sort}
          onSort={setSort}
          onSync={vault.sync}
          syncing={vault.syncing}
          syncProgress={vault.syncProgress}
          onCheck={() => vault.checkUpdates()}
          checking={vault.checking}
          metaLabel={`${items.length} / ${vault.catalog.length || 0} 条`}
          searchRef={searchRef}
        />

        <div
          className="content"
          ref={contentRef}
          onScroll={(event) => {
            const el = event.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 420 && remaining > 0) {
              setVisible((value) => value + 48);
            }
          }}
        >
          <div className="content__head">
            <span className="content__title">{activeTag ? `标签：${activeTag}` : meta.title}</span>
            <span className="content__count">{items.length}</span>
            <span className="content__hint">{meta.hint}</span>
          </div>

          {items.length === 0 ? (
            renderEmpty()
          ) : (
            <div className="grid">
              {items.slice(0, visible).map(({ entry, installed }) => (
                <TrainerCard
                  key={entry.id}
                  entry={entry}
                  installed={installed}
                  download={vault.downloads[entry.id]}
                  selected={selectedId === entry.id}
                  onOpen={() => setSelectedId(entry.id)}
                  onLaunch={() => installed && launch(installed.id, installed.title)}
                />
              ))}
            </div>
          )}

          {remaining > 0 ? (
            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <button type="button" className="btn btn--sm" onClick={() => setVisible((value) => value + 96)}>
                加载更多（剩余 {remaining}）
              </button>
            </div>
          ) : null}
        </div>

        {selected ? (
          <DetailDrawer
            target={selected}
            download={vault.downloads[selected.entry.id]}
            onClose={() => setSelectedId(null)}
            onInstall={vault.install}
            onCancel={vault.cancel}
            onLaunch={launch}
            onRemove={vault.remove}
            onPatch={vault.patch}
            onReveal={(path) => api().system.reveal(path)}
            onOpenSite={(url) => api().system.openSite(url)}
          />
        ) : null}

        <Transfers items={Object.values(vault.downloads)} onCancel={vault.cancel} />
      </main>

      {settingsOpen && vault.settings ? (
        <SettingsModal
          settings={vault.settings}
          appInfo={vault.appInfo}
          onClose={() => setSettingsOpen(false)}
          onSave={(patch) => vault.saveSettings(patch)}
          onPickFolder={() => api().settings.pickFolder()}
        />
      ) : null}

      <Toast toast={vault.toast} />
    </div>
  );
}
