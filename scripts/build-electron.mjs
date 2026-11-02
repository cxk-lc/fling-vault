import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
  minify: false,
  external: ['electron'],
  logLevel: 'info',
};

await build({
  ...common,
  entryPoints: [resolve(root, 'electron/main.ts')],
  outfile: resolve(root, 'dist-electron/main.js'),
});

await build({
  ...common,
  entryPoints: [resolve(root, 'electron/preload.ts')],
  outfile: resolve(root, 'dist-electron/preload.js'),
});

await build({
  ...common,
  entryPoints: [resolve(root, 'electron/smoke.ts')],
  outfile: resolve(root, 'dist-electron/smoke.js'),
});
