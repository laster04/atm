import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
  listedLeagueWhere,
  listedPlayerWhere,
  listedSeasonWhere,
  listedSeriesWhere,
  listedTeamWhere,
} from '../services/visibility.js';

/**
 * The data half of the site's sitemap: one URL per public page that shows a
 * record. The static pages and the help articles are known to the frontend,
 * which writes them into its own sitemap at build time and points its sitemap
 * index at this one.
 *
 * Only what a signed-out visitor finds in a list belongs here. An unlisted
 * league opens by link, but publishing that link to a search engine would
 * undo the point of unlisting it, so every query uses the listed* filters
 * with no viewer.
 */

// The public site, not this API's host: the frontend proxies this document
// from its own domain, and every URL in it has to be on that domain.
const siteUrl = (): string => (process.env.SITE_URL || 'https://www.atm-online.cz').replace(/\/+$/, '');

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

interface Entry {
  path: string;
  updatedAt: Date;
}

const urlEntry = (base: string, { path, updatedAt }: Entry): string =>
  `  <url><loc>${escapeXml(base + path)}</loc><lastmod>${updatedAt.toISOString()}</lastmod></url>`;

const select = { id: true, updatedAt: true } as const;

export const getSitemap = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [leagues, seasons, teams, players, series, tournaments] = await Promise.all([
      prisma.league.findMany({ where: listedLeagueWhere(undefined), select }),
      prisma.season.findMany({ where: listedSeasonWhere(undefined), select }),
      prisma.team.findMany({ where: listedTeamWhere(undefined), select }),
      prisma.player.findMany({ where: listedPlayerWhere(undefined), select }),
      prisma.tournamentSeries.findMany({ where: listedSeriesWhere(undefined), select }),
      prisma.tournament.findMany({ where: { series: listedSeriesWhere(undefined) }, select }),
    ]);

    const entries: Entry[] = [
      ...leagues.map(r => ({ path: `/leagues/${r.id}`, updatedAt: r.updatedAt })),
      ...seasons.map(r => ({ path: `/season-detail/${r.id}`, updatedAt: r.updatedAt })),
      ...teams.map(r => ({ path: `/teams/${r.id}`, updatedAt: r.updatedAt })),
      ...players.map(r => ({ path: `/players/${r.id}`, updatedAt: r.updatedAt })),
      ...series.map(r => ({ path: `/tournaments/${r.id}`, updatedAt: r.updatedAt })),
      ...tournaments.map(r => ({ path: `/tournament/${r.id}`, updatedAt: r.updatedAt })),
    ];

    const base = siteUrl();
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries.map(entry => urlEntry(base, entry)),
      '</urlset>',
      '',
    ].join('\n');

    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(xml);
  } catch (error) {
    console.error('Sitemap error:', error);
    res.status(500).json({ error: 'Failed to build the sitemap' });
  }
};
