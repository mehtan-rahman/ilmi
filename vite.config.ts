import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tauri sets TAURI_ENV_PLATFORM when it drives the dev server.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // the text library's web build (milestone 61) is found before the first page, so a dev run does not reload when a collection first syncs
  optimizeDeps: { include: ['loro-crdt/web'] },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    watch: { ignored: ['**/src-tauri/**', '**/.claude/**'] },
  },
  build: {
    outDir: 'dist',
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  test: {
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
  },
});
