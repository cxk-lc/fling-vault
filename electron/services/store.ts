import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { dataDir } from './paths';

/**
 * 极简原子 JSON 存储：先写临时文件再 rename，避免进程中断产生半截文件。
 */
export class JsonStore<T> {
  private readonly file: string;
  private cache: T | null = null;
  private readonly fallback: T;

  constructor(fileName: string, fallback: T) {
    mkdirSync(dataDir(), { recursive: true });
    this.file = path.join(dataDir(), fileName);
    this.fallback = fallback;
  }

  get path(): string {
    return this.file;
  }

  read(): T {
    if (this.cache) return this.cache;
    try {
      if (existsSync(this.file)) {
        this.cache = JSON.parse(readFileSync(this.file, 'utf-8')) as T;
        return this.cache;
      }
    } catch (error) {
      console.warn(`[store] 读取 ${path.basename(this.file)} 失败，使用默认值`, error);
    }
    this.cache = JSON.parse(JSON.stringify(this.fallback)) as T;
    return this.cache;
  }

  write(value: T): T {
    this.cache = value;
    const tmp = `${this.file}.${process.pid}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf-8');
      renameSync(tmp, this.file);
    } catch (error) {
      console.error(`[store] 写入 ${path.basename(this.file)} 失败`, error);
    }
    return value;
  }

  update(mutator: (draft: T) => void): T {
    const draft = this.read();
    mutator(draft);
    return this.write(draft);
  }

  size(): number {
    try {
      return existsSync(this.file) ? statSync(this.file).size : 0;
    } catch {
      return 0;
    }
  }

  remove(): void {
    this.cache = null;
    try {
      if (existsSync(this.file)) unlinkSync(this.file);
    } catch {
      /* ignore */
    }
  }
}
