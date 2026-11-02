import { API_BASE, PAGE_SIZE, SITE_ORIGIN, TRAINER_CATEGORY_ID } from '../shared/constants';
import type { CatalogEntry, TrainerOption } from '../shared/types';
import { fetchJson, fetchText } from './http';

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

/** "Phantom Blade Zero Trainer" → "Phantom Blade Zero" */
export function cleanTitle(raw: string): string {
  return decodeEntities(raw)
    .replace(/\s*[-–—]\s*FLiNG\s*$/i, '')
    .replace(/\s*Trainer\s*$/i, '')
    .trim();
}

interface WpPost {
  id: number;
  date: string;
  modified: string;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
}

interface ContentMeta {
  optionCount: number;
  gameVersion: string;
  lastUpdated: string;
  cover?: string;
  coverThumb?: string;
}

export function parseContentMeta(html: string): ContentMeta {
  const text = decodeEntities(stripTags(html.slice(0, 400)));
  const flat = text.replace(/\s+/g, ' ');
  const optionMatch = flat.match(/(\d+)\s*Options?/i);
  const versionMatch = flat.match(/Game\s*Version:\s*([^·|]+)/i);
  const updatedMatch = flat.match(/Last\s*Updated:\s*([0-9.\-/]+)/i);
  const covers = parseCover(html);
  return {
    optionCount: optionMatch ? Number(optionMatch[1]) : 0,
    gameVersion: versionMatch ? versionMatch[1].trim() : '',
    lastUpdated: updatedMatch ? updatedMatch[1].trim() : '',
    cover: covers.cover,
    coverThumb: covers.coverThumb,
  };
}

function parseCover(html: string): { cover?: string; coverThumb?: string } {
  const matches = html.match(/<img[^>]+src="([^"]+)"[^>]*>/gi) ?? [];
  for (const tag of matches) {
    const src = tag.match(/src="([^"]+)"/i)?.[1];
    if (!src) continue;
    if (src.includes('tooltip-icon')) continue;
    if (!src.includes('/wp-content/uploads/')) continue;
    const absolute = src.startsWith('http') ? src : `${SITE_ORIGIN}${src}`;
    // 卡片用 300w 缩略图，抽屉用原图
    const srcset = tag.match(/srcset="([^"]+)"/i)?.[1];
    let coverThumb = absolute;
    if (srcset) {
      const candidates = srcset
        .split(',')
        .map((item) => item.trim().split(/\s+/))
        .map(([url, width]) => ({ url, width: parseInt(width ?? '0', 10) || 0 }))
        .filter((item) => item.width >= 300)
        .sort((a, b) => a.width - b.width);
      if (candidates[0]) coverThumb = candidates[0].url;
    }
    return { cover: absolute, coverThumb };
  }
  return {};
}

/** 从详情页正文解析快捷键列表（与修改器本体一致的 "Num 1 – God Mode" 结构）。 */
export function parseOptions(html: string): TrainerOption[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<span[^>]*class=['"][^'"]*tooltipsall[^'"]*['"][^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h6|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  const lines = decodeEntities(cleaned)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const options: TrainerOption[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const match = line.match(/^(.{2,26}?)\s+[–—-]\s+(.{1,160})$/);
    if (!match) continue;
    const key = match[1].trim();
    const name = match[2].trim();
    if (!key || !name) continue;
    if (!/(num|\+|^[A-Za-z0-9]$)/i.test(key)) continue;
    const dedupe = `${key}::${name}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    options.push({ key, name });
  }
  return options;
}

export interface DownloadInfo {
  token: string;
  fileName: string;
  fileDate: string;
  fileSize: string;
  fileSizeBytes: number;
}

export function parseDownloadInfo(html: string): DownloadInfo | null {
  const anchor = html.match(
    /href="(https:\/\/flingtrainer\.com\/downloads\/[^"]+)"[^>]*title="([^"]*)"[^>]*class="attachment-link"/i,
  );
  if (!anchor) return null;
  const date = html.match(/<td class="attachment-date">\s*([^<]+?)\s*<\/td>/i)?.[1]?.trim() ?? '';
  const size = html.match(/<td class="attachment-size">\s*([^<]+?)\s*<\/td>/i)?.[1]?.trim() ?? '';
  return {
    token: anchor[1],
    fileName: decodeEntities(anchor[2]),
    fileDate: date,
    fileSize: size,
    fileSizeBytes: parseSize(size),
  };
}

export function parseSize(size: string): number {
  const match = size.trim().match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2].toUpperCase();
  const factor = unit === 'GB' ? 1024 ** 3 : unit === 'MB' ? 1024 ** 2 : unit === 'KB' ? 1024 : 1;
  return Math.round(value * factor);
}

/** "Phantom.Blade.Zero.v1.0.Plus.36.Trainer-FLiNG" → "v1.0 Plus 36" */
export function guessVersion(fileName: string): string {
  const match = fileName.match(/v\d+(?:\.\d+)*(?:[.\-]Plus[.\-]\d+)?/i);
  if (!match) return '';
  return match[0].replace(/[.\-]Plus[.\-]/i, ' Plus ').replace(/\.$/, '');
}

function toEntry(post: WpPost): CatalogEntry {
  const meta = parseContentMeta(post.content.rendered);
  const title = cleanTitle(post.title.rendered);
  return {
    id: post.id,
    slug: post.slug,
    title,
    siteUrl: post.link,
    cover: meta.cover,
    coverThumb: meta.coverThumb,
    optionCount: meta.optionCount,
    gameVersion: meta.gameVersion,
    lastUpdated: meta.lastUpdated,
    postDate: post.date,
    postModified: post.modified,
    keywords: `${title} ${post.slug}`.toLowerCase(),
  };
}

const FIELDS = 'id,date,modified,slug,link,title,content';

export interface CatalogFetchResult {
  entries: CatalogEntry[];
  total: number;
}

/** 抓取目录（分页 + 并发 3 + 进度回调）。 */
export async function fetchCatalog(
  onProgress?: (done: number, total: number) => void,
): Promise<CatalogFetchResult> {
  const first = await fetchJson<WpPost[]>(
    `${API_BASE}/posts?categories=${TRAINER_CATEGORY_ID}&per_page=${PAGE_SIZE}&page=1&orderby=date&order=desc&_fields=${FIELDS}`,
  );
  const totalPages = Number(first.headers.get('X-WP-TotalPages') ?? 1);
  const total = Number(first.headers.get('X-WP-Total') ?? first.data.length);
  const entries = first.data.map(toEntry);
  onProgress?.(1, totalPages);

  const rest = Array.from({ length: Math.max(0, totalPages - 1) }, (_v, i) => i + 2);
  let done = 1;
  const queue = [...rest];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    for (;;) {
      const page = queue.shift();
      if (!page) return;
      try {
        const result = await fetchJson<WpPost[]>(
          `${API_BASE}/posts?categories=${TRAINER_CATEGORY_ID}&per_page=${PAGE_SIZE}&page=${page}&orderby=date&order=desc&_fields=${FIELDS}`,
        );
        entries.push(...result.data.map(toEntry));
      } catch (error) {
        console.warn(`[site] 第 ${page} 页抓取失败，已跳过`, error);
      } finally {
        done += 1;
        onProgress?.(done, totalPages);
      }
    }
  });
  await Promise.all(workers);

  const unique = new Map<number, CatalogEntry>();
  for (const entry of entries) unique.set(entry.id, entry);
  return { entries: [...unique.values()].sort((a, b) => (a.postDate < b.postDate ? 1 : -1)), total };
}

/** 按 ID 批量取最新状态，用于「检查更新」（一次请求覆盖全部已安装项）。 */
export async function fetchPostsByIds(ids: number[]): Promise<CatalogEntry[]> {
  if (ids.length === 0) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const all: CatalogEntry[] = [];
  for (const chunk of chunks) {
    const { data } = await fetchJson<WpPost[]>(
      `${API_BASE}/posts?include=${chunk.join(',')}&per_page=100&_fields=${FIELDS}`,
    );
    all.push(...data.map(toEntry));
  }
  return all;
}

export interface DetailPayload {
  info: DownloadInfo | null;
  options: TrainerOption[];
}

const detailCache = new Map<number, { at: number; payload: DetailPayload }>();
const DETAIL_TTL = 10 * 60 * 1000;

/** 详情页 HTML 才有下载令牌与完整快捷键表，按需拉取并缓存。 */
export async function fetchDetail(siteUrl: string, id: number): Promise<DetailPayload> {
  const cached = detailCache.get(id);
  if (cached && Date.now() - cached.at < DETAIL_TTL) return cached.payload;
  const { body } = await fetchText(siteUrl);
  const payload: DetailPayload = { info: parseDownloadInfo(body), options: parseOptions(body) };
  detailCache.set(id, { at: Date.now(), payload });
  return payload;
}

export function invalidateDetail(id: number): void {
  detailCache.delete(id);
}
