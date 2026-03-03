import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default ({ mode }) => {
  // Load environment variables for the current mode
  const env = loadEnv(mode, process.cwd(), '');

  // Correct way to read VITE_ variables inside vite.config.js
  const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3003';

  return defineConfig({
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icon.svg'],
        manifest: {
          name: 'PENALIS — Motor de Precisión Jurídica Penal',
          short_name: 'PENALIS',
          description:
            'Inteligencia jurídica especializada para el ejercicio penal venezolano.',
          theme_color: '#0a0a0b',
          background_color: '#0a0a0b',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          ],
          categories: ['business', 'productivity'],
          lang: 'es',
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
        devOptions: { enabled: true },
      }),
    ],

    // Local development server config ONLY — Vercel does NOT use this
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
      },
    },
  });
};