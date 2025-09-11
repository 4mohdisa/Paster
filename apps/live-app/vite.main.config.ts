import { resolve } from 'path';

import { defineConfig } from 'vite';

export default defineConfig({
  mode: process.env.NODE_ENV || 'development',
  root: resolve(__dirname, 'src'),
  build: {
    outDir: resolve(__dirname, '.vite/build/main'),
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'child_process',
        'fs',
        'path',
        'util',
        'os',
        'crypto',
        'events',
        'stream',
        'assert',
        'buffer',
        'url',
        'net',
        'tls',
        'http',
        'https',
        'zlib',
        'ws',
        '@google/genai',
        'dotenv',
        'menubar',
        'lodash',
        'electron-squirrel-startup',
      ],
      output: {
        format: 'cjs',
      },
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