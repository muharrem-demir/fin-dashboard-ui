import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { appConfigPlugin } from './vite-plugins/app-config-plugin';

/**
 * The dev server serves the app and nothing else — there is no proxy.
 *
 * The browser calls the Java API directly at the absolute URL in `config/*.yaml`, which means those
 * requests are cross-origin and the backend has to allow this origin itself. Point the app at a
 * different backend with APP_API_BASE_URL / APP_WS_URL rather than by adding a proxy here.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [appConfigPlugin(), react(), tailwindcss()],

    server: {
      port: Number(env.PORT ?? 5173),
      // Fail loudly rather than silently moving to 5174: the port is part of this app's origin, and
      // the backend's CORS allow-list names that origin exactly.
      strictPort: true,
    },

    preview: {
      port: Number(env.PREVIEW_PORT ?? 4173),
      strictPort: true,
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
