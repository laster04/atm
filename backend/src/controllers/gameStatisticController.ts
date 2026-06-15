import { Request, Response } from 'express';
import prisma from '../config/database.js';
import {
	AuthRequest,
	CreateHockeyGameStatisticRequest,
	UpdateHockeyGameStatisticRequest,
} from '../types/index.js';
import { Prisma } from '@prisma/client';

export const getStatisticsByGameId = async (req: Request, res: Response): Promise<void> => {
	try {
		const { gameId } = req.params;
		const statistics = await prisma.hockeyGameStatistic.findMany({
			where: { gameId: parseInt(gameId) },
			include: {
				player: {
					include: { team: true }
				}
			},
			orderBy: [
				{ goals: 'desc' },
				{ assists: 'desc' }
			]
		});
		res.json(statistics);
	} catch (error) {
		console.error('Get game statistics error:', error);
		res.status(500).json({ error: 'Failed to fetch game statistics' });
	}
};

export const getStatisticsByPlayerId = async (req: Request, res: Response): Promise<void> => {
	try {
		const { playerId } = req.params;
		const statistics = await prisma.hockeyGameStatistic.findMany({
			where: { playerId: parseInt(playerId) },
			include: {
				game: {
					include: {
						homeTeam: true,
						awayTeam: true
					}
				}
			},
			orderBy: { game: { date: 'desc' } }
		});
		res.json(statistics);
	} catch (error) {
		console.error('Get player statistics error:', error);
		res.status(500).json({ error: 'Failed to fetch player statistics' });
	}
};

export const getStatisticById = async (req: Request, res: Response): Promise<void> => {
	try {
		const { id } = req.params;
		const statistic = await prisma.hockeyGameStatistic.findUnique({
			where: { id: parseInt(id) },
			include: {
				player: {
					include: { team: true }
				},
				game: {
					include: {
						homeTeam: true,
						awayTeam: true,
						season: true
					}
				}
			}
		});

		if (!statistic) {
			res.status(404).json({ error: 'Statistic not found' });
			return;
		}

		res.json(statistic);
	} catch (error) {
		console.error('Get statistic error:', error);
		res.status(500).json({ error: 'Failed to fetch statistic' });
	}
};

export const createStatistic = async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { gameId } = req.params;
		const { playerId, goals, assists } = req.body as CreateHockeyGameStatisticRequest;

		if (!playerId) {
			res.status(400).json({ error: 'Player ID is required' });
			return;
		}

		const game = await prisma.game.findUnique({
			where: { id: parseInt(gameId) },
			include: { season: true }
		});
		if (!game) {
			res.status(404).json({ error: 'Game not found' });
			return;
		}

		const player = await prisma.player.findUnique({
			where: { id: parseInt(String(playerId)) },
			include: { team: true }
		});
		if (!player) {
			res.status(404).json({ error: 'Player not found' });
			return;
		}

		// Check if player's team is in this game's season
		const teamInSeason = await prisma.seasonTeam.findUnique({
			where: {
				seasonId_teamId: {
					seasonId: game.seasonId,
					teamId: player.teamId
				}
			}
		});
		if (!teamInSeason) {
			res.status(400).json({ error: 'Player does not belong to a team in this game\'s season' });
			return;
		}

		if (game.homeTeamId !== player.teamId && game.awayTeamId !== player.teamId) {
			res.status(400).json({ error: 'Player\'s team is not participating in this game' });
			return;
		}

		// Check if statistic already exists for this player in this game
		const existingStatistic = await prisma.hockeyGameStatistic.findFirst({
			where: {
				gameId: parseInt(gameId),
				playerId: parseInt(String(playerId))
			}
		});
		if (existingStatistic) {
			res.status(400).json({ error: 'Statistic already exists for this player in this game' });
			return;
		}

		const statistic = await prisma.hockeyGameStatistic.create({
			data: {
				gameId: parseInt(gameId),
				playerId: parseInt(String(playerId)),
				goals: goals ?? null,
				assists: assists ?? null
			},
			include: {
				player: {
					include: { team: true }
				}
			}
		});

		res.status(201).json(statistic);
	} catch (error) {
		console.error('Create statistic error:', error);
		res.status(500).json({ error: 'Failed to create statistic' });
	}
};

export const updateStatistic = async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { id } = req.params;
		const { goals, assists } = req.body as UpdateHockeyGameStatisticRequest;

		const statistic = await prisma.hockeyGameStatistic.update({
			where: { id: parseInt(id) },
			data: {
				...(goals !== undefined && { goals }),
				...(assists !== undefined && { assists })
			},
			include: {
				player: {
					include: { team: true }
				}
			}
		});

		res.json(statistic);
	} catch (error) {
		if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
			res.status(404).json({ error: 'Statistic not found' });
			return;
		}
		console.error('Update statistic error:', error);
		res.status(500).json({ error: 'Failed to update statistic' });
	}
};

export const deleteStatistic = async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { id } = req.params;

		await prisma.hockeyGameStatistic.delete({ where: { id: parseInt(id) } });
		res.json({ message: 'Statistic deleted successfully' });
	} catch (error) {
		if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
			res.status(404).json({ error: 'Statistic not found' });
			return;
		}
		console.error('Delete statistic error:', error);
		res.status(500).json({ error: 'Failed to delete statistic' });
	}
};

async function aggregatePlayerStats(gameFilter: Prisma.GameWhereInput, options?: { limit?: number; teamId?: number }) {
	const games = await prisma.game.findMany({
		where: gameFilter,
		select: { id: true }
	});
	const gameIds = games.map(g => g.id);

	const statisticFilter: Prisma.HockeyGameStatisticWhereInput = { gameId: { in: gameIds } };
	if (options?.teamId) {
		statisticFilter.player = { teamId: options.teamId };
	}

	const statistics = await prisma.hockeyGameStatistic.findMany({
		where: statisticFilter,
		include: {
			player: {
				include: { team: true }
			}
		}
	});

	const playerStats = new Map<number, {
		player: typeof statistics[0]['player'];
		goals: number;
		assists: number;
		gamesPlayed: number;
	}>();

	for (const stat of statistics) {
		const existing = playerStats.get(stat.playerId);
		if (existing) {
			existing.goals += stat.goals || 0;
			existing.assists += stat.assists || 0;
			existing.gamesPlayed += 1;
		} else {
			playerStats.set(stat.playerId, {
				player: stat.player,
				goals: stat.goals || 0,
				assists: stat.assists || 0,
				gamesPlayed: 1
			});
		}
	}

	const sorted = Array.from(playerStats.values())
		.map(ps => ({ ...ps, points: ps.goals + ps.assists }))
		.sort((a, b) => b.points - a.points || b.goals - a.goals);

	return options?.limit ? sorted.slice(0, options.limit) : sorted;
}

export const getTopScorersBySeason = async (req: Request, res: Response): Promise<void> => {
	try {
		const { seasonId } = req.params;
		const limit = parseInt(req.query.limit as string) || 10;

		const result = await aggregatePlayerStats(
			{ seasonId: parseInt(seasonId) },
			{ limit }
		);
		res.json(result);
	} catch (error) {
		console.error('Get top scorers error:', error);
		res.status(500).json({ error: 'Failed to fetch top scorers' });
	}
};

export const getScorersBySeasonAndTeam = async (req: Request, res: Response): Promise<void> => {
	try {
		const { seasonId, teamId } = req.params;
		const teamIdNum = parseInt(teamId);

		const result = await aggregatePlayerStats(
			{
				seasonId: parseInt(seasonId),
				OR: [{ homeTeamId: teamIdNum }, { awayTeamId: teamIdNum }]
			},
			{ teamId: teamIdNum }
		);
		res.json(result);
	} catch (error) {
		console.error('Get team scorers error:', error);
		res.status(500).json({ error: 'Failed to fetch team scorers' });
	}
};
