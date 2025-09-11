import { resolve } from 'path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  mode: process.env.NODE_ENV || 'development',
  root: resolve(__dirname, 'src'),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '.vite/build/renderer'),
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
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
  server: {
    port: 3000,
    host: 'localhost',
  },
  css: {
    postcss: resolve(__dirname, 'postcss.config.mjs'),
  },
  publicDir: resolve(__dirname, 'public'),
  base: './',
});