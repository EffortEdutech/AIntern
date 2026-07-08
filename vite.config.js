// vite.config.js
// AIntern — Production Vite Configuration (seeded from WorkLedger e78a5a6a)
// Dev server fixed to port 4900 per project convention.
// ⚠️  Service workers ONLY run after: npm run build && npm run preview
//     Never test PWA/SW in npm run dev — it will NOT work.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    port: 4900,
    strictPort: true,
  },
  preview: {
    port: 4900,
    strictPort: true,
  },
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // Files that live in /public root to include in SW precache.
      // pwa-asset-generator put everything directly in /public (no subfolder).
      // Icons from the original set are in /public/icons/ with x-style names.
      includeAssets: [
        'favicon.ico',
        'robots.txt',
        'apple-icon-180.png',
        'apple-splash-*.png',
        'manifest-icon-192.maskable.png',
        'manifest-icon-512.maskable.png',
        'icons/icon-192x192.png',
        'icons/icon-512x512.png',
      ],

      // Service workers break Vite HMR — never enable in dev.
      // Test PWA with: npm run build && npm run preview
      devOptions: {
        enabled: false,
      },

      manifest: {
        name: 'AIntern',
        short_name: 'AIntern',
        description: 'Your internship logbook — daily logs, supervisor sign-off, PDF reports',
        start_url: '/',
        id: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        lang: 'en-MY',
        categories: ['business', 'productivity', 'utilities'],

        // ICON STRATEGY — what exists on disk after pwa-asset-generator:
        //   /public/icons/icon-192x192.png      ← original icons (any purpose)
        //   /public/icons/icon-512x512.png      ← original icons (any purpose)
        //   /public/manifest-icon-192.maskable.png  ← generated maskable
        //   /public/manifest-icon-512.maskable.png  ← generated maskable
        //   /public/apple-icon-180.png          ← iOS touch icon
        //
        // Chrome requires at least one icon ≥ 144px with purpose "any"
        // and at least one with purpose "maskable" for adaptive icons.
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/manifest-icon-192.maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/manifest-icon-512.maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],

        shortcuts: [
          {
            name: 'New Work Entry',
            short_name: 'New Entry',
            description: 'Create a new work entry',
            url: '/work/new',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Pending Approvals',
            short_name: 'Approvals',
            description: 'Review work entries awaiting approval',
            url: '/work/approvals',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
          },
        ],
      },

      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/rest/, /^\/auth/, /^\/storage/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],

  build: {
    // Drop all console.* calls and debugger statements from the production
    // bundle. Logs remain fully visible during `npm run dev`.
    esbuild: {
      drop: ['console', 'debugger'],
    },

    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-offline': ['dexie'],
          'vendor-auth': ['@supabase/supabase-js'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons': ['@heroicons/react'],
        },
      },
    },
  },
})
