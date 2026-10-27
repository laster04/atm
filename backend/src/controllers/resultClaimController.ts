import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { canManageGame, isAdmin } from '../services/access.js';
import { claimBlock, claimState, seasonClaims, settleClaims } from '../services/games/resultClaims.js';
import { syncFixtureEvents } from '../services/teamEvents/mirror.js';
import { syncPlayoff } from '../services/playoff/sync.js';

/** A score nobody plays to: keeps a typo from becoming a result. */
const MAX_SCORE = 999;

const loadGame = (id: string) =>
  prisma.game.findUnique({
    where: { id },
    include: {
      season: { select: { archivedAt: true, autoConfirmAgreed: true, league: { select: { sportType: true } } } },
      homeTeam: { select: { managerId: true } },
      awayTeam: { select: { managerId: true } },
      resultClaims: { select: { teamId: true, homeScore: true, awayScore: true, updatedAt: true } },
    },
  });

type LoadedGame = NonNullable<Awaited<ReturnType<typeof loadGame>>>;

/** The teams in this game the user runs. An admin speaks for either side. */
const ownSides = (game: LoadedGame, userId: string, admin: boolean): string[] =>
  [
    { id: game.homeTeamId, managerId: game.homeTeam.managerId },
    { id: game.awayTeamId, managerId: game.awayTeam.managerId },
  ]
    .filter(team => admin || team.managerId === userId)
    .map(team => team.id);

/**
 * What one viewer may see of the claims. The season manager sees everything. A
 * team sees its own claim, and the other side's only once its own is in, so
 * each side reports what it saw instead of copying the first answer.
 */
const view = (game: LoadedGame, sides: string[], seesAll: boolean) => {
  const ownClaimed = game.resultClaims.some(c => sides.includes(c.teamId));
  return {
    block: claimBlock(game),
    autoConfirm: game.season.autoConfirmAgreed,
    state: claimState(game, game.season.autoConfirmAgreed),
    teamIds: sides,
    claims: game.resultClaims.map(claim => {
      const visible = seesAll || ownClaimed || sides.includes(claim.teamId);
      return {
        teamId: claim.teamId,
        submitted: true,
        homeScore: visible ? claim.homeScore : null,
        awayScore: visible ? claim.awayScore : null,
        updatedAt: claim.updatedAt,
      };
    }),
  };
};

export const getResultClaims = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const game = await loadGame(req.params.id);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    const user = req.user!;
    const sides = ownSides(game, user.id, isAdmin(user));
    const seesAll = await canManageGame(user, game.id);
    if (!seesAll && sides.length === 0) {
      res.status(403).json({ error: 'Not authorized to view the results reported for this game' });
      return;
    }
    res.json(view(game, sides, seesAll));
  } catch (error) {
    console.error('Get result claims error:', error);
    res.status(500).json({ error: 'Failed to fetch the reported results' });
  }
};

/** A team's manager reports how the game ended. Two matching reports settle it. */
export const submitResultClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, teamId } = req.params;
    const { homeScore, awayScore } = req.body as { homeScore?: unknown; awayScore?: unknown };

    const valid = (value: unknown): value is number =>
      Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SCORE;
    if (!valid(homeScore) || !valid(awayScore)) {
      res.status(400).json({ error: 'Both scores must be whole numbers from 0' });
      return;
    }

    const game = await loadGame(id);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    if (teamId !== game.homeTeamId && teamId !== game.awayTeamId) {
      res.status(400).json({ error: 'This team does not play in this game' });
      return;
    }
    // Only the team's own manager speaks for it. The season manager enters the
    // result directly instead, which a claim would only duplicate.
    const user = req.user!;
    if (!ownSides(game, user.id, isAdmin(user)).includes(teamId)) {
      res.status(403).json({ error: 'Only the manager of this team can report its result' });
      return;
    }
    const block = claimBlock(game);
    if (block) {
      res.status(409).json({ error: `A result cannot be reported for this game (${block})`, block });
      return;
    }

    const outcome = await prisma.$transaction(async tx => {
      await tx.gameResultClaim.upsert({
        where: { gameId_teamId: { gameId: id, teamId } },
        create: { gameId: id, teamId, homeScore, awayScore, submittedById: user.id },
        update: { homeScore, awayScore, submittedById: user.id },
      });
      return settleClaims(tx, id, user.id);
    });

    if (outcome === 'CONFIRMED') {
      // The game is now played: the calendar and the bracket follow.
      await syncFixtureEvents(id);
      await syncPlayoff(game.seasonId);
    }

    const fresh = await loadGame(id);
    res.json({ ...view(fresh!, ownSides(fresh!, user.id, isAdmin(user)), await canManageGame(user, id)), outcome });
  } catch (error) {
    console.error('Submit result claim error:', error);
    res.status(500).json({ error: 'Failed to report the result' });
  }
};

/** Every game in a season the teams have reported on, for the season manager. */
export const getSeasonResultClaims = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const claims = await seasonClaims(req.params.seasonId);
    if (!claims) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }
    res.json(claims);
  } catch (error) {
    console.error('Get season result claims error:', error);
    res.status(500).json({ error: 'Failed to fetch the reported results' });
  }
};
