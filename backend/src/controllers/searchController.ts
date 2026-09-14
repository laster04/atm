import { Request, Response } from 'express';
import prisma from '../config/database.js';

/**
 * One box, four kinds of answer: teams, players, seasons and leagues.
 *
 * The header's search is a jump-to rather than a report, so each kind returns
 * only its best few matches and every row carries what a person needs to tell
 * two similarly named things apart — the player's team, the season's league.
 */
export const searchAll = async (req: Request, res: Response): Promise<void> => {
	try {
		const q = ((req.query.q as string) ?? '').trim();
		const perKind = Math.min(parseInt(req.query.limit as string) || 5, 20);

		// Two characters is where a prefix stops matching half the database.
		if (q.length < 2) {
			res.json({ query: q, teams: [], players: [], seasons: [], leagues: [] });
			return;
		}

		const contains = { contains: q, mode: 'insensitive' as const };

		const [teams, players, seasons, leagues] = await Promise.all([
			prisma.team.findMany({
				where: { name: contains },
				select: { id: true, name: true, logo: true, primaryColor: true, _count: { select: { players: true } } },
				orderBy: { name: 'asc' },
				take: perKind
			}),
			prisma.player.findMany({
				where: { name: contains },
				select: {
					id: true, name: true, number: true, position: true,
					team: { select: { id: true, name: true, primaryColor: true } }
				},
				orderBy: { name: 'asc' },
				take: perKind
			}),
			prisma.season.findMany({
				where: { name: contains },
				select: {
					id: true, name: true, status: true, startDate: true, endDate: true,
					league: { select: { id: true, name: true, sportType: true } }
				},
				orderBy: { startDate: 'desc' },
				take: perKind
			}),
			prisma.league.findMany({
				where: { name: contains },
				select: { id: true, name: true, sportType: true, logo: true, _count: { select: { seasons: true } } },
				orderBy: { name: 'asc' },
				take: perKind
			})
		]);

		res.json({ query: q, teams, players, seasons, leagues });
	} catch (error) {
		console.error('Search error:', error);
		res.status(500).json({ error: 'Search failed' });
	}
};
