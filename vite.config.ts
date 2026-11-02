import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(root, 'src'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(root, 'electron/shared'),
    },
  },
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    target: 'chrome124',
    sourcemap: false,
  },
  server: {
    port: 5321,
    strictPort: true,
  },
});
