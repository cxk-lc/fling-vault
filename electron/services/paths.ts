import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function userDataDir(): string {
  return app.getPath('userData');
}

export function dataDir(): string {
  const dir = path.join(userDataDir(), 'data');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function defaultLibraryDir(): string {
  return path.join(userDataDir(), 'library');
}

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function tempDir(): string {
  const dir = path.join(userDataDir(), 'tmp');
  mkdirSync(dir, { recursive: true });
  return dir;
}
