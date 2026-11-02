import { useEffect, useMemo, useRef, useState } from 'react';
import type { LibraryEntry } from '@shared/types';
import { api } from '../lib/api';
import { matchScore, relativeTime } from '../lib/format';

export default function QuickPanel() {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const reload = () => {
    api()
      .library.list()
      .then(setLibrary)
      .catch(() => undefined);
  };

  useEffect(() => {
    reload();
    const offLibrary = api().on.library(reload);
    const offToggle = api().on.quickToggle(() => {
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    });
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      offLibrary();
      offToggle();
      clearTimeout(focusTimer);
    };
  }, []);

  const rows = useMemo(() => {
    const base = [...library].sort((a, b) => {
      const fav = Number(b.favorite) - Number(a.favorite);
      if (fav !== 0) return fav;
      return (b.lastLaunchedAt ?? 0) - (a.lastLaunchedAt ?? 0);
    });
    if (!query.trim()) return base;
    return base
      .map((item) => ({ item, score: matchScore(`${item.title} ${item.slug} ${item.tags.join(' ')}`, query) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((row) => row.item);
  }, [library, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const node = listRef.current?.children[index] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const launch = async (entry: LibraryEntry) => {
    await api().system.hidePanel();
    try {
      await api().trainer.launch(entry.id);
    } catch {
      /* 主窗口会给出提示 */
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIndex((value) => Math.min(rows.length - 1, value + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIndex((value) => Math.max(0, value - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = rows[index];
      if (target) launch(target);
    } else if (event.key === 'Escape') {
      api().system.hidePanel();
    }
  };

  return (
    <div className="quick-root">
      <div className="quick">
        <div className="quick__head">
          <span className="quick__mark">F</span>
          <input
            ref={inputRef}
            className="quick__input"
            value={query}
            placeholder="搜索已安装的修改器，回车启动…"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="quick__esc">ESC</span>
        </div>

        <div className="quick__list" ref={listRef}>
          {rows.length === 0 ? (
            <div className="quick__empty">
              {library.length === 0
                ? '本地库为空。先在主窗口同步目录并下载一个修改器。'
                : '没有匹配的修改器。'}
            </div>
          ) : (
            rows.map((item, i) => (
              <div
                className="quick__item"
                key={item.id}
                data-active={i === index}
                onMouseEnter={() => setIndex(i)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  launch(item);
                }}
              >
                {item.coverThumb || item.cover ? (
                  <img className="quick__cover" src={item.coverThumb ?? item.cover} alt="" />
                ) : null}
                <div className="quick__info">
                  <div className="quick__name">{item.title}</div>
                  <div className="quick__sub">
                    {item.version || '—'} · 最近启动 {relativeTime(item.lastLaunchedAt)}
                  </div>
                </div>
                <span className="quick__hint">{i === index ? 'ENTER' : item.favorite ? '★' : ''}</span>
              </div>
            ))
          )}
        </div>

        <div className="quick__foot">
          <span>↑↓ 选择</span>
          <span>ENTER 启动</span>
          <span>ESC 关闭</span>
          <span style={{ marginLeft: 'auto' }}>{rows.length} 项</span>
        </div>
      </div>
    </div>
  );
}
