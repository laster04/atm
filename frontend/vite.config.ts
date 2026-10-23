import { defineConfig, type Plugin } from 'vite'
import path from 'path'
import fs from 'fs'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sitemap } from './sitemap'

/**
 * The embedded widget (celek I) is a second page with its own small bundle.
 * In development /embed/... is served embed.html, as server.mjs and .htaccess
 * do in production; and the build keeps the service worker's registration out
 * of it, since it runs inside other websites.
 */
function embedPage(): Plugin {
  let outDir = 'dist'
  return {
    name: 'atm-embed-page',
    enforce: 'post',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && /^\/embed\/(season|tournament)\//.test(req.url)) req.url = '/embed.html'
        next()
      })
    },
    // VitePWA writes its registration into every HTML page once the bundle is
    // closed, so it is taken out of the widget's page at that point too.
    closeBundle() {
      const file = path.join(outDir, 'embed.html')
      if (!fs.existsSync(file)) return
      const html = fs.readFileSync(file, 'utf8')
        .replace(/<link rel="manifest"[^>]*>/g, '')
        .replace(/<script[^>]*registerSW\.js[^>]*><\/script>/g, '')
      fs.writeFileSync(file, html)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    sitemap(),
    // Installable app: manifest plus a service worker that caches only the app
    // shell. API calls always go to the network - a cached score or table would
    // be worse than none.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['pwa/apple-touch-icon.png', 'pwa/favicon-64.png'],
      manifest: {
        name: 'ATM - amateur team management',
        short_name: 'ATM',
        description: 'Leagues, seasons, teams and results for amateur sport',
        lang: 'cs',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        icons: [
          { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // The sitemaps and robots.txt are for crawlers; a browser opening one
        // should get the file, not the app shell.
        // The widget runs inside other websites and must never be answered with the app shell.
        navigateFallbackDenylist: [/^\/api\//, /^\/sitemap[\w-]*\.xml$/, /^\/robots\.txt$/, /^\/embed[/.]/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
    // After VitePWA: it takes back out of the widget's page what VitePWA added.
    embedPage(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        embed: path.resolve(__dirname, 'embed.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@types': path.resolve(__dirname, './src/types/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      // server.mjs does the same in production.
      '/sitemap-data.xml': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: () => '/api/sitemap.xml'
      }
    }
  }
})
