import { resolve } from 'path';

import { defineConfig } from 'vite';

export default defineConfig({
  mode: process.env.NODE_ENV || 'development',
  root: resolve(__dirname, 'src'),
  build: {
    outDir: resolve(__dirname, '.vite/build/preload'),
    lib: {
      entry: resolve(__dirname, 'src/preload.ts'),
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: {
      external: [
        'electron',
      ],
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});