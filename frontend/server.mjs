import http from 'node:http'
import { readFileSync } from 'node:fs'
import compression from 'compression'
import handler from 'serve-handler'

/**
 * Serves the built app the way `serve -s dist` did - same serve-handler, same
 * dist/serve.json, every unknown path falling back to index.html - plus one
 * route `serve` cannot do: /sitemap-data.xml, fetched from the backend so the
 * data sitemap lives on this domain, as Search Console requires.
 *
 * Only the embedded widget (/embed/...) may be shown inside other websites;
 * every other page refuses to be framed, so no one can lay the app under a
 * fake page and trick a signed-in user into clicking (clickjacking).
 * public/.htaccess does the same on Apache hosting; keep the two in step.
 */

const PUBLIC = 'dist'
const PORT = Number(process.env.PORT || 3000)
const API_URL = (process.env.API_URL || process.env.VITE_API_URL || '').replace(/\/+$/, '')

const config = {
  ...JSON.parse(readFileSync(`${PUBLIC}/serve.json`, 'utf8')),
  public: PUBLIC,
  etag: true,
  rewrites: [{ source: '**', destination: '/index.html' }],
}

async function dataSitemap(res) {
  try {
    const upstream = await fetch(`${API_URL}/sitemap.xml`)
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/xml',
      'Cache-Control': upstream.headers.get('cache-control') ?? 'public, max-age=3600',
    })
    res.end(await upstream.text())
  } catch (error) {
    console.error('Sitemap proxy error:', error)
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Sitemap unavailable')
  }
}

// The widget's own page. serve-handler would hand a rewrite to embed.html on
// to the '**' fallback as well, so widget paths are answered here directly.
const embedHtml = readFileSync(`${PUBLIC}/embed.html`)

const compress = compression()

http
  .createServer((req, res) => {
    compress(req, res, () => {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
      if (/^\/embed[/.]/.test(pathname)) {
        res.setHeader('Content-Security-Policy', 'frame-ancestors *')
        if (pathname.startsWith('/embed/')) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
          res.end(embedHtml)
          return
        }
      } else {
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self'")
        res.setHeader('X-Frame-Options', 'SAMEORIGIN')
      }
      if (pathname === '/sitemap-data.xml') {
        void dataSitemap(res)
        return
      }
      void handler(req, res, config)
    })
  })
  .listen(PORT, () => {
    console.log(`Serving ${PUBLIC} on port ${PORT}`)
  })
