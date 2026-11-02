import { useState, type FC } from 'react';
import type { CatalogEntry, DownloadProgress, LibraryEntry } from '@shared/types';
import { shortDate } from '../lib/format';
import { IconPlay, IconStar } from './Icon';

interface TrainerCardProps {
  entry: CatalogEntry;
  installed?: LibraryEntry;
  download?: DownloadProgress;
  selected: boolean;
  onOpen: () => void;
  onLaunch: () => void;
}

export const TrainerCard: FC<TrainerCardProps> = ({
  entry,
  installed,
  download,
  selected,
  onOpen,
  onLaunch,
}) => {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const downloading = download && download.state !== 'done' && download.state !== 'error';
  const status = installed?.updateAvailable
    ? { label: '可更新', tone: 'chip--amber' }
    : installed
      ? { label: '已安装', tone: 'chip--ok' }
      : { label: '未安装', tone: '' };

  return (
    <article
      className="card"
      data-selected={selected}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen();
      }}
    >
      <div className={`card__cover${loaded || broken || !entry.cover ? '' : ' is-loading'}`}>
        {entry.cover && !broken ? (
          <img
            src={entry.coverThumb ?? entry.cover}
            alt=""
            decoding="async"
            className={loaded ? 'is-ready' : ''}
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="card__cover-fallback">no preview</div>
        )}
        <div className="card__badges">
          <span className={`chip ${status.tone}`}>{status.label}</span>
          {downloading ? <span className="chip chip--amber">{Math.round(download.percent)}%</span> : null}
          {installed?.favorite ? (
            <span className="chip chip--amber" style={{ padding: '0 4px' }}>
              <IconStar size={9} filled />
            </span>
          ) : null}
        </div>
        {installed ? (
          <button
            type="button"
            className="card__launch"
            onClick={(event) => {
              event.stopPropagation();
              onLaunch();
            }}
          >
            <IconPlay size={9} />
            启动
          </button>
        ) : null}
      </div>

      <div className="card__body">
        <h3 className="card__title">{entry.title}</h3>
        <div className="card__meta">
          <span>{entry.optionCount || '—'} OPT</span>
          <i className="card__sep" />
          <span>{entry.gameVersion || '—'}</span>
          <i className="card__sep" />
          <span>{shortDate(entry.lastUpdated)}</span>
        </div>
      </div>

      {downloading ? (
        <div className="card__progress">
          <i style={{ width: `${Math.max(3, download.percent)}%` }} />
        </div>
      ) : null}
    </article>
  );
};
