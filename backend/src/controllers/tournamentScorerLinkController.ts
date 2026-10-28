import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { teamAllowance } from '../services/plans/tournamentPlan.js';
import { PlanFeatureError, planFeatureBody } from '../services/tournaments/plus.js';
import { linkStatus, MAX_LABEL_LENGTH, newToken, toLinkSummary } from '../services/games/scorerLink.js';
import {
  blockFor,
  courtLinkExpiry,
  currentCourtLink,
  findCourtLinkByToken,
  recomputeFromGoals,
  scorerModeFor,
  tournamentScorerLinkUrl,
  type TournamentScorerBlock,
} from '../services/tournaments/scorerLink.js';
import { checkParts, partsWon, profileFor } from '../services/sports/profile.js';
import { afterResult } from './tournamentGameController.js';

// ── The organiser's side ─────────────────────────────────────────────────────
// Guarded by requireTournamentAccess: the series manager or an administrator.

/** The courts of a tournament: every location its games are played at. */
const courtsOf = async (tournamentId: string) => {
  const games = await prisma.tournamentGame.findMany({
    where: { tournamentId, location: { not: null } },
    select: { location: true, date: true },
  });
  const courts = new Map<string, { games: number; lastGame: Date | null }>();
  for (const game of games) {
    const location = game.location!;
    if (!location.trim()) continue;
    const court = courts.get(location) ?? { games: 0, lastGame: null };
    court.games += 1;
    if (game.date && (!court.lastGame || game.date > court.lastGame)) court.lastGame = game.date;
    courts.set(location, court);
  }
  return courts;
};

/** GET /tournaments/:tournamentId/scorer-links — each court with its live (or lapsed) link, never a token. */
export const getCourtLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { series: { select: { sportType: true } } },
    });
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    const [allowance, courts] = await Promise.all([teamAllowance(tournamentId), courtsOf(tournamentId)]);
    const links = await Promise.all([...courts.keys()].map(location => currentCourtLink(tournamentId, location)));

    res.json({
      mode: scorerModeFor(tournament.series.sportType),
      allowed: allowance != null && allowance.plan !== 'FREE',
      plan: allowance?.plan ?? 'FREE',
      courts: [...courts].map(([location, court], index) => ({
        location,
        games: court.games,
        link: links[index] ? toLinkSummary(links[index]!) : null,
      })),
    });
  } catch (error) {
    console.error('Get court scorer links error:', error);
    res.status(500).json({ error: 'Failed to fetch the scorer links' });
  }
};

/**
 * POST /tournaments/:tournamentId/scorer-links — a new link for one court,
 * which cancels the court's earlier one. The address is in this answer only.
 */
export const createCourtLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const { location, label } = req.body as { location?: unknown; label?: unknown };
    if (typeof location !== 'string' || !location.trim()) {
      res.status(400).json({ error: 'location is required' });
      return;
    }
    if (label !== undefined && label !== null && typeof label !== 'string') {
      res.status(400).json({ error: 'label must be text' });
      return;
    }
    const name = label?.trim() || null;
    if (name && name.length > MAX_LABEL_LENGTH) {
      res.status(400).json({ error: `label is at most ${MAX_LABEL_LENGTH} characters` });
      return;
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { endDate: true, series: { select: { sportType: true } } },
    });
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    if (!scorerModeFor(tournament.series.sportType)) {
      res.status(409).json({ error: 'This sport has no report a scorer could keep', code: 'SPORT' });
      return;
    }
    const allowance = await teamAllowance(tournamentId);
    if (!allowance || allowance.plan === 'FREE') {
      const error = new PlanFeatureError('SCORER_LINKS', allowance?.plan ?? 'FREE', 0);
      res.status(409).json(planFeatureBody(error));
      return;
    }
    const court = (await courtsOf(tournamentId)).get(location);
    if (!court) {
      res.status(404).json({ error: 'No game of this tournament is played at this location', code: 'COURT' });
      return;
    }

    const { token, tokenHash } = newToken();
    const link = await prisma.$transaction(async tx => {
      await tx.tournamentScorerLink.updateMany({
        where: { tournamentId, location, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return tx.tournamentScorerLink.create({
        data: {
          tournamentId,
          location,
          label: name,
          tokenHash,
          expiresAt: courtLinkExpiry(court.lastGame, tournament.endDate),
          createdById: req.user!.id,
        },
      });
    });

    res.status(201).json({ link: toLinkSummary(link), url: tournamentScorerLinkUrl(token) });
  } catch (error) {
    console.error('Create court scorer link error:', error);
    res.status(500).json({ error: 'Failed to create the scorer link' });
  }
};

/** DELETE /tournaments/:tournamentId/scorer-links/:linkId — the link stops working at once. */
export const revokeCourtLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId, linkId } = req.params;
    const link = await prisma.tournamentScorerLink.findUnique({ where: { id: linkId } });
    if (!link || link.tournamentId !== tournamentId) {
      res.status(404).json({ error: 'Scorer link not found' });
      return;
    }
    if (!link.revokedAt) {
      await prisma.tournamentScorerLink.update({ where: { id: link.id }, data: { revokedAt: new Date() } });
    }
    res.json({ link: null });
  } catch (error) {
    console.error('Revoke court scorer link error:', error);
    res.status(500).json({ error: 'Failed to cancel the scorer link' });
  }
};

// ── The scorer's side ────────────────────────────────────────────────────────
// No account: the link's token is the credential, and it opens one court.

type CourtLink = NonNullable<Awaited<ReturnType<typeof findCourtLinkByToken>>>;

const teamSelect = { select: { id: true, name: true, logo: true, primaryColor: true } };

const loadCourtGames = (link: CourtLink) =>
  prisma.tournamentGame.findMany({
    where: { tournamentId: link.tournamentId, location: link.location },
    select: {
      id: true,
      phase: true,
      date: true,
      status: true,
      homeScore: true,
      awayScore: true,
      periodScores: true,
      keptByLink: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: teamSelect,
      awayTeam: teamSelect,
      group: { select: { name: true } },
      _count: { select: { statistics: true } },
    },
    orderBy: [{ date: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  });

type CourtGame = Awaited<ReturnType<typeof loadCourtGames>>[number];

const BLOCK_MESSAGE: Record<TournamentScorerBlock, string> = {
  HAND_RESULT: 'The organiser already entered this result by hand.',
  NOT_PLAYED: 'This game is postponed or cancelled.',
  TEAMS_UNKNOWN: 'The teams of this game are not known yet.',
};

/** Everything the scorer's page shows: the court's games, and the open one's goals and rosters. */
const courtView = async (link: CourtLink, openGameId?: string) => {
  const status = linkStatus(link);
  const mode = scorerModeFor(link.tournament.series.sportType);
  const base = {
    status,
    label: link.label,
    location: link.location,
    expiresAt: link.expiresAt,
    mode,
    tournament: {
      id: link.tournament.id,
      name: link.tournament.name,
      seriesName: link.tournament.series.name,
      sportType: link.tournament.series.sportType,
      // Volleyball: how many sets the tournament plays, as the organiser set it.
      setFormat: (link.tournament.scoring as { setFormat?: string } | null)?.setFormat ?? null,
    },
  };
  // A link that no longer works says which court it was for, and nothing more.
  if (status !== 'ACTIVE') return { ...base, games: [], game: null };

  const games = await loadCourtGames(link);
  const open = games.find(game => game.id === openGameId);

  let game = null;
  if (open && open.homeTeamId && open.awayTeamId) {
    const [goals, players] = await Promise.all([
      prisma.tournamentGoal.findMany({
        where: { gameId: open.id },
        include: {
          player: { select: { id: true, name: true, number: true } },
          assistPlayer: { select: { id: true, name: true, number: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.tournamentPlayer.findMany({
        where: { teamId: { in: [open.homeTeamId, open.awayTeamId] } },
        select: { id: true, name: true, number: true, teamId: true },
        orderBy: [{ number: 'asc' }, { name: 'asc' }],
      }),
    ]);
    const rosters: Record<string, { id: string; name: string; number: number | null }[]> = {
      [open.homeTeamId]: [],
      [open.awayTeamId]: [],
    };
    for (const { teamId, ...player } of players) rosters[teamId]?.push(player);
    game = {
      id: open.id,
      goals: goals.map(({ scorerLinkId, ...goal }) => ({ ...goal, mine: scorerLinkId === link.id })),
      rosters,
    };
  }

  return {
    ...base,
    games: games.map(({ _count, keptByLink, homeTeamId, awayTeamId, group, ...rest }) => ({
      ...rest,
      groupName: group?.name ?? null,
      block: blockFor({ ...rest, keptByLink, homeTeamId, awayTeamId, _count }),
    })),
    game,
  };
};

type Resolved = { link: CourtLink; game: CourtGame & { homeTeamId: string; awayTeamId: string } };

/**
 * The link and the game of its court it is to change. Answers for itself and
 * returns null when the link is unknown or dead, the game is on another court,
 * or the game cannot be changed through the link.
 */
const resolveForWrite = async (req: Request, res: Response): Promise<Resolved | null> => {
  const link = await findCourtLinkByToken(req.params.token);
  if (!link) {
    res.status(404).json({ error: 'This link does not exist' });
    return null;
  }
  const status = linkStatus(link);
  if (status !== 'ACTIVE') {
    res.status(410).json({ error: 'This link no longer works', code: status });
    return null;
  }
  const game = (await loadCourtGames(link)).find(candidate => candidate.id === req.params.gameId);
  if (!game) {
    res.status(404).json({ error: 'Game not found on this court' });
    return null;
  }
  const block = blockFor(game);
  if (block) {
    res.status(409).json({ error: BLOCK_MESSAGE[block], code: block });
    return null;
  }
  return { link, game: game as Resolved['game'] };
};

const respond = async (res: Response, link: CourtLink, gameId: string, extra: object = {}) => {
  res.json({ ...(await courtView(link, gameId)), ...extra });
};

const touch = (tx: Prisma.TransactionClient, link: CourtLink) =>
  tx.tournamentScorerLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });

/** A correction to a finished game moves the standings' followers on again. */
const resettle = async (gameId: string) => {
  const game = await prisma.tournamentGame.findUniqueOrThrow({ where: { id: gameId } });
  if (game.status === 'COMPLETED') await afterResult(game);
};

/** GET /scorer/t/:token?game= */
export const getCourtPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const link = await findCourtLinkByToken(req.params.token);
    if (!link) {
      res.status(404).json({ error: 'This link does not exist' });
      return;
    }
    const gameId = typeof req.query.game === 'string' ? req.query.game : undefined;
    res.json(await courtView(link, gameId));
  } catch (error) {
    console.error('Get court scorer page error:', error);
    res.status(500).json({ error: 'Failed to load the court' });
  }
};

/** POST /scorer/t/:token/games/:gameId/goals — one goal, with its scorer and assist when known. */
export const addCourtGoal = async (req: Request, res: Response): Promise<void> => {
  try {
    const resolved = await resolveForWrite(req, res);
    if (!resolved) return;
    const { link, game } = resolved;
    if (scorerModeFor(link.tournament.series.sportType) !== 'GOALS') {
      res.status(409).json({ error: 'This sport is scored in sets', code: 'SPORT' });
      return;
    }

    const { teamId, playerId, assistPlayerId } = req.body as {
      teamId?: unknown;
      playerId?: unknown;
      assistPlayerId?: unknown;
    };
    if (teamId !== game.homeTeamId && teamId !== game.awayTeamId) {
      res.status(400).json({ error: 'teamId must be one of the two teams of this game' });
      return;
    }
    const scorer = typeof playerId === 'string' && playerId ? playerId : null;
    const assist = typeof assistPlayerId === 'string' && assistPlayerId ? assistPlayerId : null;
    if (scorer && assist && scorer === assist) {
      res.status(400).json({ error: 'A player cannot assist their own goal' });
      return;
    }
    const named = [scorer, assist].filter((id): id is string => id != null);
    if (named.length > 0) {
      const ofTeam = await prisma.tournamentPlayer.count({ where: { id: { in: named }, teamId } });
      if (ofTeam !== named.length) {
        res.status(400).json({ error: 'The scorer and the assist must play for the scoring team' });
        return;
      }
    }

    const startsGame = game.status === 'SCHEDULED';
    await prisma.$transaction(async tx => {
      await tx.tournamentGoal.create({
        data: { gameId: game.id, teamId, playerId: scorer, assistPlayerId: assist, scorerLinkId: link.id },
      });
      await recomputeFromGoals(tx, game);
      // The first goal shows the game as being played, so the public page has a live score.
      if (startsGame) await tx.tournamentGame.update({ where: { id: game.id }, data: { status: 'IN_PROGRESS' } });
      await touch(tx, link);
    });
    await resettle(game.id);

    res.status(201);
    await respond(res, link, game.id);
  } catch (error) {
    console.error('Add court goal error:', error);
    res.status(500).json({ error: 'Failed to record the goal' });
  }
};

/** DELETE /scorer/t/:token/games/:gameId/goals/:goalId — only a goal this link recorded. */
export const deleteCourtGoal = async (req: Request, res: Response): Promise<void> => {
  try {
    const resolved = await resolveForWrite(req, res);
    if (!resolved) return;
    const { link, game } = resolved;

    const goal = await prisma.tournamentGoal.findUnique({ where: { id: req.params.goalId } });
    if (!goal || goal.gameId !== game.id) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    // A goal from an earlier link of the court belongs to whoever held that one.
    if (goal.scorerLinkId !== link.id) {
      res.status(403).json({ error: 'Only goals recorded through this link can be removed here', code: 'NOT_YOURS' });
      return;
    }

    await prisma.$transaction(async tx => {
      await tx.tournamentGoal.delete({ where: { id: goal.id } });
      await recomputeFromGoals(tx, game);
      await touch(tx, link);
    });
    await resettle(game.id);

    await respond(res, link, game.id);
  } catch (error) {
    console.error('Delete court goal error:', error);
    res.status(500).json({ error: 'Failed to remove the goal' });
  }
};

/** PUT /scorer/t/:token/games/:gameId/sets — the set scores of a volleyball game. */
export const setCourtSets = async (req: Request, res: Response): Promise<void> => {
  try {
    const resolved = await resolveForWrite(req, res);
    if (!resolved) return;
    const { link, game } = resolved;
    if (scorerModeFor(link.tournament.series.sportType) !== 'SETS') {
      res.status(409).json({ error: 'This sport is scored in goals', code: 'SPORT' });
      return;
    }
    const parts = checkParts((req.body as { periodScores?: unknown }).periodScores ?? null, profileFor(link.tournament.series.sportType));
    if (!parts.ok) {
      res.status(400).json({ error: parts.error });
      return;
    }
    const sets = parts.value ?? [];
    const won = partsWon(sets);

    await prisma.$transaction(async tx => {
      await tx.tournamentGame.update({
        where: { id: game.id },
        data: {
          keptByLink: true,
          periodScores: sets.length ? (sets as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          homeScore: sets.length ? won.home : null,
          awayScore: sets.length ? won.away : null,
          ...(game.status === 'SCHEDULED' && sets.length > 0 && { status: 'IN_PROGRESS' as const }),
        },
      });
      await touch(tx, link);
    });
    await resettle(game.id);

    await respond(res, link, game.id);
  } catch (error) {
    console.error('Set court sets error:', error);
    res.status(500).json({ error: 'Failed to save the sets' });
  }
};

/**
 * POST /scorer/t/:token/games/:gameId/finish — the game is over. Its result
 * counts at once: the standings, the play-off seeds and the bracket move on.
 * The scorer may still correct it while the link works.
 */
export const finishCourtGame = async (req: Request, res: Response): Promise<void> => {
  try {
    const resolved = await resolveForWrite(req, res);
    if (!resolved) return;
    const { link, game } = resolved;

    const homeScore = game.homeScore ?? 0;
    const awayScore = game.awayScore ?? 0;
    // A play-off game sends its winner on; a level result leaves the next round without a team.
    if (game.phase !== 'GROUP' && homeScore === awayScore) {
      res.status(409).json({ error: 'A play-off game needs a winner', code: 'PLAYOFF_NEEDS_WINNER' });
      return;
    }

    const finished = await prisma.$transaction(async tx => {
      const updated = await tx.tournamentGame.update({
        where: { id: game.id },
        // A game without a single goal ended 0:0.
        data: { status: 'COMPLETED', keptByLink: true, homeScore, awayScore },
      });
      await touch(tx, link);
      return updated;
    });
    await afterResult(finished);

    await respond(res, link, game.id);
  } catch (error) {
    console.error('Finish court game error:', error);
    res.status(500).json({ error: 'Failed to finish the game' });
  }
};
