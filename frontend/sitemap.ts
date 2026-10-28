import type { Plugin } from 'vite'
import { PUBLISHED } from './src/content/docs/index'

/**
 * Writes the site's sitemap at build time. Search Console is given
 * /sitemap.xml, an index of two sitemaps:
 *
 *   sitemap-pages.xml  the static public pages and the help articles - known
 *                      here, so written into the build
 *   sitemap-data.xml   leagues, seasons, teams, players and tournaments - known
 *                      only to the backend; server.mjs proxies it from
 *                      /api/sitemap.xml so it is served from this domain
 */

const SITE_URL = (process.env.SITE_URL || 'https://www.atm-online.cz').replace(/\/+$/, '')

// Public pages only. The record pages (/teams/:id, ...) come from the backend;
// /docs is left out because it shows the same article as /docs/<first slug>.
const STATIC_PATHS = [
  '/',
  '/leagues',
  '/seasons',
  '/teams',
  '/players',
  '/games',
  '/stats',
  '/tournaments',
  '/about',
  '/updates',
  '/updates/roadmap',
  '/contact',
  '/privacy',
  '/terms',
]

const xml = (lines: string[]) => ['<?xml version="1.0" encoding="UTF-8"?>', ...lines, ''].join('\n')

export function sitemap(): Plugin {
  return {
    name: 'atm-sitemap',
    apply: 'build',
    generateBundle() {
      const paths = [...STATIC_PATHS, ...PUBLISHED.map((article) => `/docs/${article.slug}`)]

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap-pages.xml',
        source: xml([
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...paths.map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`),
          '</urlset>',
        ]),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: xml([
          '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          `  <sitemap><loc>${SITE_URL}/sitemap-pages.xml</loc></sitemap>`,
          `  <sitemap><loc>${SITE_URL}/sitemap-data.xml</loc></sitemap>`,
          '</sitemapindex>',
        ]),
      })
    },
  }
}
