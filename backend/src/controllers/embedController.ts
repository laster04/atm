import { Request, Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import {
  competitionTeams,
  embedCompetition,
  seasonGames,
  seasonTables,
  tournamentGames,
  tournamentTables,
  type EmbedKind,
} from '../services/embed/data.js';

/**
 * The embedded widget's data (celek I): read-only, no account, no cookies.
 * Answers are cached for a minute, here and in the browser, since many club
 * pages may show the same table; a per-address limit keeps a misbehaving page
 * from hammering the database.
 */

const CACHE_MS = 60 * 1000;
const cache = new Map<string, { expires: number; body: unknown }>();

const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60 * 1000;
const recentByIp = new Map<string, number[]>();

export const resetEmbedState = (): void => {
  cache.clear();
  recentByIp.clear();
};

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (recentByIp.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  recentByIp.set(ip, recent);
  return false;
}

const kindOf = (value: string): EmbedKind | null => (value === 'season' || value === 'tournament' ? value : null);
const text = (value: unknown, max = 64) => (typeof value === 'string' && value.length <= max ? value : undefined);
const rowsOf = (value: unknown) => Math.min(Math.max(Number(value) || 5, 1), 30);

/** The embedding page's host name, as the widget reports it; anything odd is "". */
export const siteOf = (value: unknown): string => {
  const host = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes('.') ? host : '';
};

/** One more view of a competition's widget on a site today. Never fails the answer. */
async function countView(kind: EmbedKind, competitionId: string, site: string): Promise<void> {
  const day = new Date(new Date().toISOString().slice(0, 10));
  const dbKind = kind === 'season' ? 'SEASON' : 'TOURNAMENT';
  try {
    await prisma.embedView.upsert({
      where: { kind_competitionId_site_day: { kind: dbKind, competitionId, site, day } },
      create: { kind: dbKind, competitionId, site, day, views: 1 },
      update: { views: { increment: 1 } },
    });
  } catch (error) {
    console.error('Embed view count error:', error);
  }
}

type View = 'standings' | 'games' | 'teams';

const handler = (view: View) => async (req: Request, res: Response): Promise<void> => {
  try {
    if (limited(req.ip ?? '')) { res.status(429).json({ error: 'Too many requests' }); return; }
    const kind = kindOf(req.params.kind);
    if (!kind) { res.status(404).json({ error: 'Not available', code: 'UNAVAILABLE' }); return; }
    const { id } = req.params;
    const team = text(req.query.team);
    const group = text(req.query.group);
    const limit = rowsOf(req.query.rows);
    const results = req.query.results === '1';

    // The widget asks to be counted once per page load, telling which site it sits on.
    if (req.query.count === '1') void countView(kind, id, siteOf(req.query.site));

    const key = JSON.stringify([view, kind, id, team, group, limit, results]);
    const hit = cache.get(key);
    let body = hit && hit.expires > Date.now() ? hit.body : undefined;
    if (body === undefined) {
      const competition = await embedCompetition(kind, id);
      if (!competition) {
        body = null;
      } else if (view === 'standings') {
        body = { competition, tables: kind === 'season' ? await seasonTables(id, group) : await tournamentTables(id, group) };
      } else if (view === 'games') {
        const games = kind === 'season'
          ? await seasonGames(id, { team, limit, results })
          : await tournamentGames(id, { team, limit, results });
        body = { competition, ...games };
      } else {
        body = { competition, teams: await competitionTeams(kind, id) };
      }
      cache.set(key, { expires: Date.now() + CACHE_MS, body });
    }

    res.set('Cache-Control', 'public, max-age=60');
    if (body === null) { res.status(404).json({ error: 'Not available', code: 'UNAVAILABLE' }); return; }
    res.json(body);
  } catch (error) {
    console.error(`Embed ${view} error:`, error);
    res.status(500).json({ error: 'Failed to load' });
  }
};

export const getEmbedStandings = handler('standings');
export const getEmbedGames = handler('games');
export const getEmbedTeams = handler('teams');

/**
 * GET /api/admin/embeds — for the admin overview: which competitions are
 * shown on other websites, on how many sites, and how often, in 30 days.
 */
export const getEmbedUsage = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await prisma.embedView.groupBy({
      by: ['kind', 'competitionId', 'site'],
      where: { day: { gte: since } },
      _sum: { views: true },
    });
    const byCompetition = new Map<string, { kind: 'SEASON' | 'TOURNAMENT'; id: string; sites: Set<string>; views: number }>();
    for (const row of rows) {
      const key = `${row.kind}:${row.competitionId}`;
      const entry = byCompetition.get(key) ?? { kind: row.kind, id: row.competitionId, sites: new Set<string>(), views: 0 };
      if (row.site) entry.sites.add(row.site);
      entry.views += row._sum.views ?? 0;
      byCompetition.set(key, entry);
    }
    const entries = [...byCompetition.values()];
    const [seasons, tournaments] = await Promise.all([
      prisma.season.findMany({
        where: { id: { in: entries.filter((e) => e.kind === 'SEASON').map((e) => e.id) } },
        select: { id: true, name: true, league: { select: { name: true } } },
      }),
      prisma.tournament.findMany({
        where: { id: { in: entries.filter((e) => e.kind === 'TOURNAMENT').map((e) => e.id) } },
        select: { id: true, name: true, series: { select: { name: true } } },
      }),
    ]);
    const names = new Map<string, string>([
      ...seasons.map((s) => [s.id, `${s.league.name} – ${s.name}`] as [string, string]),
      ...tournaments.map((t) => [t.id, `${t.series.name} – ${t.name}`] as [string, string]),
    ]);
    const allSites = new Set(entries.flatMap((entry) => [...entry.sites]));
    res.json({
      sites: allSites.size,
      views: entries.reduce((sum, entry) => sum + entry.views, 0),
      competitions: entries
        .map((entry) => ({
          kind: entry.kind === 'SEASON' ? 'season' : 'tournament',
          id: entry.id,
          name: names.get(entry.id) ?? entry.id,
          sites: [...entry.sites].sort(),
          views: entry.views,
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 20),
    });
  } catch (error) {
    console.error('Embed usage error:', error);
    res.status(500).json({ error: 'Failed to load widget usage' });
  }
};
