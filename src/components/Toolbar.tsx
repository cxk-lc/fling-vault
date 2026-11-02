import type { FC } from 'react';
import { IconRefresh, IconSearch } from './Icon';

export type SortKey = 'updated' | 'name' | 'installed';

interface ToolbarProps {
  query: string;
  onQuery: (value: string) => void;
  sort: SortKey;
  onSort: (value: SortKey) => void;
  onSync: () => void;
  syncing: boolean;
  syncProgress: { done: number; total: number } | null;
  onCheck: () => void;
  checking: boolean;
  metaLabel: string;
  searchRef: React.RefObject<HTMLInputElement>;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'updated', label: '最近更新' },
  { key: 'name', label: '名称' },
  { key: 'installed', label: '安装时间' },
];

export const Toolbar: FC<ToolbarProps> = ({
  query,
  onQuery,
  sort,
  onSort,
  onSync,
  syncing,
  syncProgress,
  onCheck,
  checking,
  metaLabel,
  searchRef,
}) => (
  <div className="toolbar">
    <div className="search">
      <span className="search__icon">
        <IconSearch />
      </span>
      <input
        ref={searchRef}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="搜索游戏名、修改器特征…"
        spellCheck={false}
      />
      <kbd>/</kbd>
    </div>

    <div className="segmented">
      {SORTS.map((item) => (
        <button
          key={item.key}
          type="button"
          data-active={sort === item.key}
          onClick={() => onSort(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>

    <div className="toolbar__spacer" />
    <span className="toolbar__meta">{metaLabel}</span>

    <button type="button" className="btn" onClick={onCheck} disabled={checking}>
      {checking ? <span className="btn__spinner" /> : <IconRefresh size={13} />}
      检查更新
    </button>
    <button type="button" className="btn btn--primary" onClick={onSync} disabled={syncing}>
      {syncing ? <span className="btn__spinner" /> : <IconRefresh size={13} />}
      {syncing && syncProgress ? `同步 ${syncProgress.done}/${syncProgress.total}` : '同步官网目录'}
    </button>
  </div>
);
