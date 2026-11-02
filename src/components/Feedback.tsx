import type { FC } from 'react';
import type { DownloadProgress } from '@shared/types';
import { formatBytes, formatSpeed } from '../lib/format';
import type { ToastState } from '../state/useVault';

export const Transfers: FC<{ items: DownloadProgress[]; onCancel: (id: number) => void }> = ({ items, onCancel }) => {
  const active = items.filter((item) => item.state === 'downloading' || item.state === 'preparing');
  if (active.length === 0) return null;
  return (
    <div className="transfers">
      {active.map((item) => (
        <div className="transfer" key={item.id}>
          <div className="transfer__top">
            <span className="transfer__name">{item.title}</span>
            <span className="transfer__pct">{Math.round(item.percent)}%</span>
          </div>
          <div className="transfer__bar">
            <i style={{ width: `${Math.max(2, item.percent)}%` }} />
          </div>
          <div className="transfer__foot">
            <span>
              {formatBytes(item.received)} / {item.total ? formatBytes(item.total) : '—'} · {formatSpeed(item.speed)}
            </span>
            <button type="button" onClick={() => onCancel(item.id)}>
              取消
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export const Toast: FC<{ toast: ToastState | null }> = ({ toast }) =>
  toast ? (
    <div className="toast" data-kind={toast.kind}>
      <i
        style={{
          width: 5,
          height: 5,
          background: toast.kind === 'error' ? 'var(--danger)' : toast.kind === 'success' ? 'var(--ok)' : 'var(--amber)',
        }}
      />
      {toast.text}
    </div>
  ) : null;

export const EmptyState: FC<{
  mark: string;
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}> = ({ mark, title, text, actionLabel, onAction, secondaryLabel, onSecondary }) => (
  <div className="empty">
    <span className="empty__mark">{mark}</span>
    <h2 className="empty__title">{title}</h2>
    <p className="empty__text">{text}</p>
    {actionLabel || secondaryLabel ? (
      <div className="empty__actions">
        {actionLabel ? (
          <button type="button" className="btn btn--primary" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
        {secondaryLabel ? (
          <button type="button" className="btn" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    ) : null}
  </div>
);
