import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import type { CatalogEntry, DownloadProgress, LibraryEntry } from '@shared/types';
import type { DetailPayload } from '../lib/api';
import { api } from '../lib/api';
import { formatBytes, formatDate, formatDateTime, relativeTime } from '../lib/format';
import { IconClose, IconExternal, IconFolder, IconPlay, IconRefresh, IconStar, IconTrash } from './Icon';

export interface DrawerTarget {
  entry: CatalogEntry;
  installed?: LibraryEntry;
}

interface DetailDrawerProps {
  target: DrawerTarget;
  download?: DownloadProgress;
  onClose: () => void;
  onInstall: (entry: CatalogEntry) => void;
  onCancel: (id: number) => void;
  onLaunch: (id: number, title: string) => void;
  onRemove: (id: number, title: string) => void;
  onPatch: (id: number, patch: Record<string, unknown>) => void;
  onReveal: (path: string) => void;
  onOpenSite: (url: string) => void;
}

export const DetailDrawer: FC<DetailDrawerProps> = ({
  target,
  download,
  onClose,
  onInstall,
  onCancel,
  onLaunch,
  onRemove,
  onPatch,
  onReveal,
  onOpenSite,
}) => {
  const { entry, installed } = target;
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [note, setNote] = useState(installed?.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setShowAll(false);
    setConfirmDelete(false);
    setNote(installed?.note ?? '');
    setLoading(true);
    api()
      .catalog.detail(entry)
      .then((payload) => {
        if (alive) setDetail(payload);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    scrollRef.current?.scrollTo({ top: 0 });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  useEffect(() => {
    setNote(installed?.note ?? '');
  }, [installed?.note]);

  const options = useMemo(() => {
    if (installed?.optionKeys?.length) return installed.optionKeys;
    return detail?.options ?? [];
  }, [detail, installed]);

  const visibleOptions = showAll ? options : options.slice(0, 24);
  const downloading = download && download.state !== 'done' && download.state !== 'error';
  const version = installed?.version || (detail?.info ? detail.info.fileName : '') || '—';
  const fileSize = installed?.fileSize || detail?.info?.fileSizeBytes || 0;
  const canUpdate = Boolean(installed?.updateAvailable);

  const addTag = () => {
    const value = tagInput.trim();
    if (!value || !installed) return;
    if (installed.tags.includes(value)) {
      setTagInput('');
      return;
    }
    onPatch(installed.id, { tags: [...installed.tags, value] });
    setTagInput('');
  };

  return (
    <aside className="drawer">
      <div className="drawer__head">
        <div className="drawer__cover">
          {entry.cover ? <img src={entry.cover} alt="" /> : null}
        </div>
        <button type="button" className="drawer__close" onClick={onClose} aria-label="关闭">
          <IconClose />
        </button>
        <div className="drawer__titles">
          <div className="drawer__title">{entry.title}</div>
          <div className="drawer__sub">
            <span>{entry.optionCount || '—'} OPTIONS</span>
            <i className="card__sep" />
            <span>GAME {entry.gameVersion || '—'}</span>
            <i className="card__sep" />
            <span>{entry.lastUpdated || '—'}</span>
          </div>
        </div>
      </div>

      <div className="drawer__actions">
        {installed ? (
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onLaunch(installed.id, installed.title)}
            >
              <IconPlay size={10} />
              启动修改器
            </button>
            {canUpdate ? (
              <button type="button" className="btn" onClick={() => onInstall(entry)} disabled={Boolean(downloading)}>
                <IconRefresh size={12} />
                更新
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn--ghost"
              title="打开所在文件夹"
              onClick={() => onReveal(installed.filePath)}
            >
              <IconFolder size={13} />
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              title={installed.favorite ? '取消收藏' : '收藏'}
              onClick={() => onPatch(installed.id, { favorite: !installed.favorite })}
            >
              <IconStar size={13} filled={installed.favorite} />
            </button>
            <button
              type="button"
              className={`btn btn--ghost ${confirmDelete ? 'btn--danger' : ''}`}
              title="删除本地文件"
              onClick={() => {
                if (confirmDelete) {
                  onRemove(installed.id, installed.title);
                  setConfirmDelete(false);
                } else {
                  setConfirmDelete(true);
                  setTimeout(() => setConfirmDelete(false), 4000);
                }
              }}
            >
              <IconTrash size={13} />
              {confirmDelete ? '确认' : ''}
            </button>
          </>
        ) : (
          <>
            {downloading ? (
              <button type="button" className="btn" onClick={() => onCancel(entry.id)}>
                取消下载 {Math.round(download.percent)}%
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => onInstall(entry)}>
                下载并安装
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={() => onOpenSite(entry.siteUrl)}>
              <IconExternal size={13} />
              官网页面
            </button>
          </>
        )}
      </div>

      <div className="drawer__scroll" ref={scrollRef}>
        {downloading ? (
          <div style={{ marginTop: 14 }}>
            <div className="transfer__bar" style={{ marginTop: 0 }}>
              <i style={{ width: `${Math.max(2, download.percent)}%` }} />
            </div>
            <div className="transfer__foot">
              <span>
                {formatBytes(download.received)} / {formatBytes(download.total)}
              </span>
              <span>{Math.round(download.percent)}%</span>
            </div>
          </div>
        ) : null}

        <dl className="meta-grid" style={{ marginTop: 14 }}>
          <dt>版本</dt>
          <dd>{version || '—'}</dd>
          <dt>文件大小</dt>
          <dd>{fileSize ? formatBytes(fileSize) : '—'}</dd>
          <dt>官网更新</dt>
          <dd>{entry.lastUpdated || '—'}</dd>
          {installed ? (
            <>
              <dt>安装时间</dt>
              <dd>{formatDateTime(installed.installedAt)}</dd>
              <dt>最近启动</dt>
              <dd>{relativeTime(installed.lastLaunchedAt)}</dd>
            </>
          ) : (
            <>
              <dt>下载文件</dt>
              <dd>{detail?.info?.fileName ?? (loading ? '读取中…' : '—')}</dd>
              <dt>发布日期</dt>
              <dd>{formatDate(entry.postDate)}</dd>
            </>
          )}
        </dl>

        <div className="section-label">修改项 · {options.length || entry.optionCount || 0}</div>
        {options.length === 0 ? (
          <div className="rail__empty" style={{ padding: '6px 0' }}>
            {loading ? '正在读取快捷键列表…' : '未能解析快捷键列表，可打开官网页面查看。'}
          </div>
        ) : (
          <div className="options">
            {visibleOptions.map((option) => (
              <div className="option" key={`${option.key}-${option.name}`}>
                <span className="option__key">{option.key}</span>
                <span className="option__name">{option.name}</span>
              </div>
            ))}
            {options.length > 24 ? (
              <div className="options__more">
                <span>共 {options.length} 项</span>
                <button type="button" onClick={() => setShowAll((value) => !value)}>
                  {showAll ? '收起' : '展开全部'}
                </button>
              </div>
            ) : null}
          </div>
        )}

        {installed ? (
          <>
            <div className="section-label">标签</div>
            <div className="tag-row">
              {installed.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                  <button
                    type="button"
                    onClick={() => onPatch(installed.id, { tags: installed.tags.filter((item) => item !== tag) })}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                className="tag-add"
                value={tagInput}
                placeholder="+ 新标签"
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addTag();
                }}
                onBlur={addTag}
              />
            </div>

            <div className="section-label">备注</div>
            <textarea
              className="note-input"
              value={note}
              placeholder="例如：先启动游戏再开修改器；Num 9 用于刷材料…"
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => {
                if (note !== (installed.note ?? '')) onPatch(installed.id, { note });
              }}
            />
          </>
        ) : null}

        <div className="section-label">来源</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.8 }}>
          <div>数据与文件均来自 flingtrainer.com（FLiNG）。</div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ marginTop: 6 }}
            onClick={() => onOpenSite(entry.siteUrl)}
          >
            <IconExternal size={12} />
            打开官网原文
          </button>
        </div>
      </div>
    </aside>
  );
};
