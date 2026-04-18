import { defineConfig } from 'vitest/config';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      // Monorepo package: npm dev does not link workspace:*; resolve source directly
      '@meetezri/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  // Prevent aggressive browser caching during local development and preview,
  // which can cause stale bundles when the dev server is restarted.
  server: {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
    // Same-origin `/api/*` in dev so admin pages (e.g. engagement metrics) work without CORS issues.
    // Override target with VITE_DEV_API_PROXY_TARGET if the API listens elsewhere.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
