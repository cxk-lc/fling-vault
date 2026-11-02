export function formatBytes(bytes: number, digits = 1): string {
  if (!bytes || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : digits)} ${units[unit]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!bytesPerSecond) return '—';
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatDate(value?: number | string): string {
  if (!value) return '—';
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

export function formatDateTime(value?: number): string {
  if (!value) return '—';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${formatDate(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function relativeTime(value?: number): string {
  if (!value) return '从未';
  const diff = Date.now() - value;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return formatDate(value);
}

/** 官网日期 "2026.10.29" → "10.29" */
export function shortDate(value?: string): string {
  if (!value) return '—';
  const parts = value.split(/[.\-/]/).filter(Boolean);
  if (parts.length >= 3) return `${parts[1]}.${parts[2]}`;
  return value;
}

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ').trim();
}

export function matchScore(keywords: string, query: string): number {
  const q = normalize(query);
  if (!q) return 1;
  const target = normalize(keywords);
  if (target.includes(q)) return 3;
  const tokens = q.split(' ').filter(Boolean);
  const hit = tokens.filter((token) => target.includes(token)).length;
  return hit === tokens.length ? 2 : 0;
}
