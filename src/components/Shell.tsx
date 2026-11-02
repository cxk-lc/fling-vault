import type { FC } from 'react';
import {
  IconArrowUpCircle,
  IconDownloaded,
  IconExternal,
  IconGrid,
  IconSettings,
  IconStar,
} from './Icon';

export type ViewKey = 'catalog' | 'installed' | 'updates' | 'favorites';

interface TitleBarProps {
  syncLabel: string;
  onQuickLaunch: () => void;
}

export const TitleBar: FC<TitleBarProps> = ({ syncLabel, onQuickLaunch }) => (
  <header className="titlebar">
    <span className="titlebar__mark">F</span>
    <span className="titlebar__name">FLiNG Vault</span>
    <span className="titlebar__sep" />
    <span className="titlebar__sub">风灵月影修改器库</span>
    <span className="titlebar__spacer" />
    <span className="titlebar__sub" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
      {syncLabel}
    </span>
    <button className="titlebar__quick" type="button" onClick={onQuickLaunch}>
      快捷启动
      <kbd>Ctrl Alt F</kbd>
    </button>
  </header>
);

interface RailProps {
  view: ViewKey;
  counts: { catalog: number; installed: number; updates: number; favorites: number };
  tags: { name: string; count: number }[];
  activeTag: string | null;
  onView: (view: ViewKey) => void;
  onTag: (tag: string | null) => void;
  onSettings: () => void;
  onSite: () => void;
}

export const Rail: FC<RailProps> = ({
  view,
  counts,
  tags,
  activeTag,
  onView,
  onTag,
  onSettings,
  onSite,
}) => {
  const items: { key: ViewKey; label: string; icon: JSX.Element; count: number }[] = [
    { key: 'catalog', label: '全部修改器', icon: <IconGrid />, count: counts.catalog },
    { key: 'installed', label: '已安装', icon: <IconDownloaded />, count: counts.installed },
    { key: 'updates', label: '可更新', icon: <IconArrowUpCircle />, count: counts.updates },
    { key: 'favorites', label: '收藏', icon: <IconStar />, count: counts.favorites },
  ];

  return (
    <nav className="rail">
      <div className="rail__label">Library</div>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="rail__item"
          data-active={view === item.key && !activeTag}
          onClick={() => {
            onTag(null);
            onView(item.key);
          }}
        >
          <span className="rail__icon">{item.icon}</span>
          {item.label}
          <span className="rail__count">{item.count || ''}</span>
        </button>
      ))}

      <div className="rail__label">Collections</div>
      {tags.length === 0 ? (
        <div className="rail__empty">在修改器详情里添加标签，即可在此按类别筛选。</div>
      ) : (
        tags.map((tag) => (
          <button
            key={tag.name}
            type="button"
            className="rail__tag"
            data-active={activeTag === tag.name}
            onClick={() => onTag(activeTag === tag.name ? null : tag.name)}
          >
            <span className="rail__dot" />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tag.name}
            </span>
            <span className="rail__count">{tag.count}</span>
          </button>
        ))
      )}

      <div className="rail__footer">
        <button type="button" className="rail__item" onClick={onSite}>
          <span className="rail__icon">
            <IconExternal size={13} />
          </span>
          flingtrainer.com
        </button>
        <button type="button" className="rail__item" onClick={onSettings}>
          <span className="rail__icon">
            <IconSettings />
          </span>
          设置
        </button>
      </div>
    </nav>
  );
};
