import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { auditSnapshot, recordAudit } from '../services/audit/record.js';
import { recomputeGameFromEvents } from '../services/matchEvents/derive.js';
import { settleClaims } from '../services/games/resultClaims.js';
import {
  currentLink,
  findByToken,
  linkExpiry,
  linkStatus,
  MAX_LABEL_LENGTH,
  newToken,
  scorerLinkSupported,
  scorerLinkUrl,
  toLinkSummary,
  viaLink,
  type ScorerBlock,
} from '../services/games/scorerLink.js';
import { syncFixtureEvents } from '../services/teamEvents/mirror.js';
import { syncPlayoff } from '../services/playoff/sync.js';
import { auditView, eventInclude, orderedByClock, toData, validate, type EventBody } from './matchEventController.js';

const GAME_AUDIT_FIELDS = ['homeScore', 'awayScore', 'status', 'confirmedAt'] as const;

// ── The season manager's side ────────────────────────────────────────────────
// Guarded by requireGameAccess: the league's manager or an administrator.

const loadManagedGame = (id: string) =>
  prisma.game.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      confirmedAt: true,
      season: { select: { archivedAt: true, league: { select: { sportType: true } } } },
    },
  });

/** GET /games/:id/scorer-link — the game's live (or lapsed) link, never its token. */
export const getScorerLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const game = await loadManagedGame(req.params.id);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    const link = await currentLink(game.id);
    res.json({
      supported: scorerLinkSupported(game.season.league.sportType),
      link: link ? toLinkSummary(link) : null,
    });
  } catch (error) {
    console.error('Get scorer link error:', error);
    res.status(500).json({ error: 'Failed to fetch the scorer link' });
  }
};

/**
 * POST /games/:id/scorer-link — a new link for the game, which cancels any
 * earlier one. The address is in this answer only; it cannot be shown again.
 */
export const createScorerLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { label } = req.body as { label?: unknown };
    if (label !== undefined && label !== null && typeof label !== 'string') {
      res.status(400).json({ error: 'label must be text' });
      return;
    }
    const name = label?.trim() || null;
    if (name && name.length > MAX_LABEL_LENGTH) {
      res.status(400).json({ error: `label is at most ${MAX_LABEL_LENGTH} characters` });
      return;
    }

    const game = await loadManagedGame(req.params.id);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    if (!scorerLinkSupported(game.season.league.sportType)) {
      res.status(409).json({ error: 'This sport has no goal report a scorer could keep', code: 'SPORT' });
      return;
    }
    if (game.season.archivedAt) {
      res.status(409).json({ error: 'Cannot modify an archived season', code: 'ARCHIVED' });
      return;
    }
    if (game.confirmedAt) {
      res.status(409).json({ error: 'This game is confirmed. Reopen it before handing out its report.', code: 'CONFIRMED' });
      return;
    }

    const { token, tokenHash } = newToken();
    const link = await prisma.$transaction(async tx => {
      await tx.scorerLink.updateMany({
        where: { gameId: game.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const created = await tx.scorerLink.create({
        data: {
          gameId: game.id,
          label: name,
          tokenHash,
          expiresAt: linkExpiry(game.date),
          createdById: req.user!.id,
        },
      });
      await recordAudit(
        {
          entityType: 'Game',
          entityId: game.id,
          action: 'SCORER_LINK_CREATE',
          after: { ...viaLink(created), expiresAt: created.expiresAt },
          actorId: req.user!.id,
        },
        tx
      );
      return created;
    });

    res.status(201).json({ link: toLinkSummary(link), url: scorerLinkUrl(token) });
  } catch (error) {
    console.error('Create scorer link error:', error);
    res.status(500).json({ error: 'Failed to create the scorer link' });
  }
};

/** DELETE /games/:id/scorer-link — the link stops working at once. */
export const revokeScorerLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gameId = req.params.id;
    const link = await currentLink(gameId);
    if (link) {
      await prisma.$transaction(async tx => {
        await tx.scorerLink.updateMany({
          where: { gameId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await recordAudit(
          {
            entityType: 'Game',
            entityId: gameId,
            action: 'SCORER_LINK_REVOKE',
            before: viaLink(link),
            actorId: req.user!.id,
          },
          tx
        );
      });
    }
    res.json({ link: null });
  } catch (error) {
    console.error('Revoke scorer link error:', error);
    res.status(500).json({ error: 'Failed to cancel the scorer link' });
  }
};

// ── The scorer's side ────────────────────────────────────────────────────────
// No account: the link's token is the credential, and it opens one game only.

const loadScoredGame = (id: string) =>
  prisma.game.findUnique({
    where: { id },
    select: {
      id: true,
      seasonId: true,
      date: true,
      location: true,
      status: true,
      homeScore: true,
      awayScore: true,
      confirmedAt: true,
      eventsAuthoritative: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { id: true, name: true, logo: true, primaryColor: true } },
      awayTeam: { select: { id: true, name: true, logo: true, primaryColor: true } },
      season: { select: { name: true, archivedAt: true, league: { select: { name: true, sportType: true } } } },
      _count: { select: { statistic: true } },
    },
  });

type ScoredGame = NonNullable<Awaited<ReturnType<typeof loadScoredGame>>>;

/** Why the link cannot change this game's report now, or null when it can. */
const scorerBlock = (game: ScoredGame): ScorerBlock | null => {
  if (game.confirmedAt) return 'CONFIRMED';
  if (game.season.archivedAt) return 'ARCHIVED';
  if (game.status === 'POSTPONED' || game.status === 'CANCELLED') return 'NOT_PLAYED';
  // Figures typed in by hand would be replaced by the first goal; whoever
  // entered them decides to give them up, not the holder of a link.
  if (!game.eventsAuthoritative && game._count.statistic > 0) return 'HAND_STATS';
  return null;
};

const BLOCK_MESSAGE: Record<ScorerBlock, string> = {
  CONFIRMED: 'This game is confirmed. Its report can no longer be changed.',
  ARCHIVED: 'This season is archived.',
  NOT_PLAYED: 'This game is postponed or cancelled.',
  HAND_STATS: 'This game already has statistics entered by hand.',
};

/** Everything the scorer's page shows, after each change too. */
const scorerView = async (link: { id: string; label: string | null; expiresAt: Date; revokedAt: Date | null }, game: ScoredGame) => {
  const status = linkStatus(link);
  const base = {
    status,
    label: link.label,
    expiresAt: link.expiresAt,
    game: {
      id: game.id,
      date: game.date,
      location: game.location,
      status: game.status,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      confirmed: game.confirmedAt != null,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      seasonName: game.season.name,
      leagueName: game.season.league.name,
      sportType: game.season.league.sportType,
    },
  };
  // A link that no longer works says which game it was for, and nothing more.
  if (status !== 'ACTIVE') return { ...base, block: null, events: [], rosters: {} };

  const [events, players] = await Promise.all([
    prisma.matchEvent.findMany({ where: { gameId: game.id }, include: eventInclude, orderBy: orderedByClock }),
    prisma.player.findMany({
      where: { teamId: { in: [game.homeTeamId, game.awayTeamId] } },
      select: { id: true, name: true, number: true, teamId: true },
      orderBy: [{ number: 'asc' }, { name: 'asc' }],
    }),
  ]);
  const rosters: Record<string, { id: string; name: string; number: number | null }[]> = {
    [game.homeTeamId]: [],
    [game.awayTeamId]: [],
  };
  for (const { teamId, ...player } of players) rosters[teamId]?.push(player);

  return {
    ...base,
    block: scorerBlock(game),
    events: events.map(event => ({ ...event, mine: event.scorerLinkId === link.id })),
    rosters,
  };
};

type Resolved = { link: NonNullable<Awaited<ReturnType<typeof findByToken>>>; game: ScoredGame };

/**
 * The link and its game, for a change. Answers for itself and returns null
 * when the link is unknown, no longer works, or the game cannot be changed.
 */
const resolveForWrite = async (req: Request, res: Response): Promise<Resolved | null> => {
  const link = await findByToken(req.params.token);
  const game = link && (await loadScoredGame(link.gameId));
  if (!link || !game) {
    res.status(404).json({ error: 'This link does not exist' });
    return null;
  }
  const status = linkStatus(link);
  if (status !== 'ACTIVE') {
    res.status(410).json({ error: 'This link no longer works', code: status });
    return null;
  }
  const block = scorerBlock(game);
  if (block) {
    res.status(409).json({ error: BLOCK_MESSAGE[block], code: block });
    return null;
  }
  return { link, game };
};

const respond = async (res: Response, link: Resolved['link'], gameId: string, extra: object = {}) => {
  const game = await loadScoredGame(gameId);
  res.json({ ...(await scorerView(link, game!)), ...extra });
};

/** GET /scorer/:token */
export const getScorerPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const link = await findByToken(req.params.token);
    const game = link && (await loadScoredGame(link.gameId));
    if (!link || !game) {
      res.status(404).json({ error: 'This link does not exist' });
      return;
    }
    res.json(await scorerView(link, game));
  } catch (error) {
    console.error('Get scorer page error:', error);
    res.status(500).json({ error: 'Failed to load the game' });
  }
};

/** POST /scorer/:token/goals — one goal, with its scorer and assists when known. */
export const addScorerGoal = async (req: Request, res: Response): Promise<void> => {
  try {
    const resolved = await resolveForWrite(req, res);
    if (!resolved) return;
    const { link, game } = resolved;

    const input = req.body as EventBody;
    const body: EventBody = {
      type: 'GOAL',
      teamId: input.teamId,
      period: input.period,
      minute: input.minute ?? null,
      playerId: input.playerId ?? null,
      assistPlayerId: input.assistPlayerId ?? null,
      secondaryAssistPlayerId: input.secondaryAssistPlayerId ?? null,
    };
    const invalid = await validate(body, game);
    if (invalid) {
      res.status(invalid.status).json({ error: invalid.error });
      return;
    }

    const startsGame = game.status === 'SCHEDULED';
    await prisma.$transaction(async tx => {
      const created = await tx.matchEvent.create({
        data: { ...toData(body), gameId: game.id, teamId: body.teamId!, scorerLinkId: link.id },
      });
      await recomputeGameFromEvents(tx, game.id);
      // The first goal shows the game as being played, so the public page has a live score.
      if (startsGame) await tx.game.update({ where: { id: game.id }, data: { status: 'IN_PROGRESS' } });
      await recordAudit(
        {
          entityType: 'Game',
          entityId: game.id,
          action: 'CREATE',
          after: { ...auditView(created), ...viaLink(link) },
          actorId: null,
        },
        tx
      );
      await tx.scorerLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
    });
    if (startsGame) await syncFixtureEvents(game.id);

    res.status(201);
    await respond(res, link, game.id);
  } catch (error) {
    console.error('Add scorer goal error:', error);
    res.status(500).json({ error: 'Failed to record the goal' });
  }
};

/** DELETE /scorer/:token/goals/:eventId — only a goal this link recorded. */
export const deleteScorerGoal = async (req: Request, res: Response): Promise<void> => {
  try {
    const resolved = await resolveForWrite(req, res);
    if (!resolved) return;
    const { link, game } = resolved;

    const event = await prisma.matchEvent.findUnique({ where: { id: req.params.eventId } });
    if (!event || event.gameId !== game.id) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    // What the season manager wrote stays theirs to change.
    if (event.scorerLinkId !== link.id) {
      res.status(403).json({ error: 'Only goals recorded through this link can be removed here', code: 'NOT_YOURS' });
      return;
    }

    await prisma.$transaction(async tx => {
      await tx.matchEvent.delete({ where: { id: event.id } });
      await recomputeGameFromEvents(tx, game.id);
      // With the last goal gone the score is no longer derived; the scorer
      // still means no goals, not whatever the removed goals had made it.
      const left = await tx.matchEvent.count({ where: { gameId: game.id } });
      if (left === 0) {
        await tx.game.update({
          where: { id: game.id },
          data: { homeScore: 0, awayScore: 0, periodScores: Prisma.JsonNull },
        });
      }
      await recordAudit(
        {
          entityType: 'Game',
          entityId: game.id,
          action: 'DELETE',
          before: { ...auditView(event), ...viaLink(link) },
          actorId: null,
        },
        tx
      );
      await tx.scorerLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
    });

    await respond(res, link, game.id);
  } catch (error) {
    console.error('Delete scorer goal error:', error);
    res.status(500).json({ error: 'Failed to remove the goal' });
  }
};

/**
 * POST /scorer/:token/finish — the game is over. It is completed but not
 * confirmed: the season manager confirms it, or the two teams do by reporting
 * the same score. The scorer may still correct goals until then.
 */
export const finishScoredGame = async (req: Request, res: Response): Promise<void> => {
  try {
    const resolved = await resolveForWrite(req, res);
    if (!resolved) return;
    const { link, game } = resolved;

    let outcome: string | null = null;
    if (game.status !== 'COMPLETED') {
      outcome = await prisma.$transaction(async tx => {
        const before = await tx.game.findUniqueOrThrow({ where: { id: game.id } });
        const updated = await tx.game.update({
          where: { id: game.id },
          data: {
            status: 'COMPLETED',
            // A game without a single goal ended 0:0.
            ...(!before.eventsAuthoritative && before.homeScore === null && { homeScore: 0, awayScore: 0 }),
          },
        });
        await recordAudit(
          {
            entityType: 'Game',
            entityId: game.id,
            action: 'UPDATE',
            before: auditSnapshot(before, [...GAME_AUDIT_FIELDS]),
            after: { ...auditSnapshot(updated, [...GAME_AUDIT_FIELDS]), ...viaLink(link) },
            actorId: null,
          },
          tx
        );
        await tx.scorerLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
        // Teams that already reported this score confirm the game now.
        return settleClaims(tx, game.id, null);
      });
      await syncFixtureEvents(game.id);
      await syncPlayoff(game.seasonId);
    }

    await respond(res, link, game.id, { outcome });
  } catch (error) {
    console.error('Finish scored game error:', error);
    res.status(500).json({ error: 'Failed to finish the game' });
  }
};
