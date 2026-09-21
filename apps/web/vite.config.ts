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
      // Same treatment for the shared public renderer, so the SPA, the admin preview and the
      // server renderer all compile from one source rather than a stale dist.
      '@meetezri/public-content': path.resolve(
        __dirname,
        '../../packages/public-content/src/index.ts'
      ),
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
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/node_modules/clsx/')) return 'vendor-utils';

          const isPackage = (packageName: string) =>
            id.includes(`/node_modules/${packageName}/`);

          // Match the installed package segment, not pnpm's parent directory metadata.
          // Broad substring checks can pull shared dependencies into a route-only chunk
          // and make Vite preload the entire chunk from the application entry.
          if (
            isPackage('react') ||
            isPackage('react-dom') ||
            isPackage('scheduler') ||
            isPackage('react-router') ||
            isPackage('react-router-dom') ||
            isPackage('@remix-run/router')
          ) return 'vendor-react';
          if (isPackage('three') || id.includes('/node_modules/@react-three/')) return 'vendor-three';
          if (isPackage('recharts') || id.includes('/node_modules/d3-')) return 'vendor-charts';
          if (id.includes('/node_modules/@mui/') || id.includes('/node_modules/@emotion/')) return 'vendor-mui';
          if (id.includes('/node_modules/@stripe/')) return 'vendor-stripe';
          if (id.includes('/node_modules/@supabase/')) return 'vendor-supabase';
          if (id.includes('/node_modules/@radix-ui/')) return 'vendor-radix';
          if (isPackage('lucide-react')) return 'vendor-icons';
          if (isPackage('motion') || isPackage('framer-motion')) return 'vendor-motion';
          if (isPackage('date-fns')) return 'vendor-datefns';
          if (isPackage('socket.io-client') || id.includes('/node_modules/@socket.io/')) return 'vendor-socket';
          if (isPackage('lodash') || isPackage('lodash-es')) return 'vendor-lodash';
          if (isPackage('react-hook-form') || id.includes('/node_modules/@hookform/') || isPackage('zod')) return 'vendor-forms';
          // TipTap/ProseMirror are admin-only and reached through a lazy import, so they must
          // land in their own chunk and never enter the public or member-app bundles.
          if (id.includes('/node_modules/@tiptap/') || id.includes('/node_modules/prosemirror-')) return 'vendor-editor';
          if (isPackage('core-js')) return 'vendor-corejs';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
