import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { appConfigPlugin } from './vite-plugins/app-config-plugin';

/**
 * The dev server proxies `/api` and `/ws` to the Java backend.
 *
 * This is what keeps the browser on one origin. The backend registers no CORS mapping for its REST
 * controllers, so a direct `fetch('http://localhost:8080/api/v1/portfolios')` from the dev server's
 * origin would be blocked by the browser before it ever reached Spring — and the nginx image does the
 * same proxying in production, so relative URLs are correct in both.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.API_PROXY_TARGET ?? 'http://localhost:8080';
  const wsTarget = env.WS_PROXY_TARGET ?? apiTarget;

  return {
    plugins: [appConfigPlugin(), react(), tailwindcss()],

    server: {
      port: Number(env.PORT ?? 5173),
      // Fail loudly rather than silently moving to 5174, which would leave the configured proxy
      // target and the actual origin out of step.
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },

    preview: {
      port: Number(env.PREVIEW_PORT ?? 4173),
      strictPort: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/ws': { target: wsTarget, ws: true, changeOrigin: true },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: true,
      // Big enough to be worth splitting: React, the query client and the router are stable between
      // deploys, so keeping them out of the app chunk lets a browser reuse them across releases.
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
  };
});
