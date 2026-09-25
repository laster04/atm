import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import {
  buildGamesSummary,
  buildRoundSummary,
  summaryRecipients,
} from '../services/digest/roundSummary.js';
import { emailService } from '../services/emailService.js';
import { recordAudit } from '../services/audit/record.js';
import { renderResultsImage } from '../services/digest/resultsImage.js';

const parseRound = (raw: string): number | null => {
  const round = Number(raw);
  return Number.isInteger(round) && round > 0 ? round : null;
};

/**
 * What the round summary would say and who would get it, without sending
 * anything. The manager sees the mail before deciding to put it in inboxes.
 */
export const previewRoundSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, round: rawRound } = req.params;
    const round = parseRound(rawRound);
    if (round === null) {
      res.status(400).json({ error: 'Round must be a positive whole number' });
      return;
    }

    const summary = await buildRoundSummary(id, round);
    if (!summary) {
      res.status(404).json({ error: 'That round has no completed games yet' });
      return;
    }

    const [recipients, lastSent] = await Promise.all([
      summaryRecipients(id),
      prisma.seasonDigest.findUnique({
        where: { seasonId_round: { seasonId: id, round } },
        include: { sentBy: { select: { id: true, name: true } } },
      }),
    ]);

    res.json({ summary, recipientCount: recipients.length, lastSent });
  } catch (error) {
    console.error('Preview round summary error:', error);
    res.status(500).json({ error: 'Failed to build the round summary' });
  }
};

/**
 * Sends the summary for one round.
 *
 * A round that has already been mailed is refused unless the caller says to send
 * it again, so a double click does not put two copies of the same mail in
 * everyone's inbox. Delivery is attempted per recipient and the count that
 * actually went out is what gets recorded: a provider failing for one address
 * must not lose the send for the rest.
 */
export const sendRoundSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, round: rawRound } = req.params;
    const { resend } = req.body as { resend?: boolean };

    const round = parseRound(rawRound);
    if (round === null) {
      res.status(400).json({ error: 'Round must be a positive whole number' });
      return;
    }

    const existing = await prisma.seasonDigest.findUnique({
      where: { seasonId_round: { seasonId: id, round } },
    });
    if (existing && resend !== true) {
      res.status(409).json({
        error: 'This round has already been sent',
        sentAt: existing.sentAt,
        recipientCount: existing.recipientCount,
      });
      return;
    }

    const summary = await buildRoundSummary(id, round);
    if (!summary) {
      res.status(404).json({ error: 'That round has no completed games yet' });
      return;
    }

    const recipients = await summaryRecipients(id);
    let delivered = 0;
    for (const recipient of recipients) {
      const sent = await emailService.sendRoundSummaryEmail(
        recipient.email,
        recipient.name,
        summary,
        parseLocale(req.body)
      );
      if (sent) delivered++;
    }

    const record = await prisma.seasonDigest.upsert({
      where: { seasonId_round: { seasonId: id, round } },
      create: { seasonId: id, round, recipientCount: delivered, sentById: req.user?.id ?? null },
      update: { recipientCount: delivered, sentAt: new Date(), sentById: req.user?.id ?? null },
    });
    // The round's games have now been mailed, so the results email screen stops
    // offering them.
    await prisma.game.updateMany({
      where: { seasonId: id, round, status: 'COMPLETED', digestId: null },
      data: { digestId: record.id },
    });

    await recordAudit({
      entityType: 'Season',
      entityId: id,
      action: existing ? 'UPDATE' : 'CREATE',
      after: { round, recipientCount: delivered, attempted: recipients.length },
      reason: existing ? 'Round summary sent again' : 'Round summary sent',
      actorId: req.user?.id ?? null,
    });

    res.json({ round, attempted: recipients.length, delivered, sentAt: record.sentAt });
  } catch (error) {
    console.error('Send round summary error:', error);
    res.status(500).json({ error: 'Failed to send the round summary' });
  }
};

/** Rounds already mailed for a season, so the manager can see what is left. */
export const listSentDigests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const digests = await prisma.seasonDigest.findMany({
      where: { seasonId: id },
      include: {
        sentBy: { select: { id: true, name: true } },
        _count: { select: { games: true } },
      },
      orderBy: { sentAt: 'desc' },
    });
    res.json(digests);
  } catch (error) {
    console.error('List digests error:', error);
    res.status(500).json({ error: 'Failed to fetch sent summaries' });
  }
};

const MAX_GAMES_PER_EMAIL = 200;

/** The picked game ids from a request body, de-duplicated, or null when unusable. */
const parseGameIds = (body: unknown): string[] | null => {
  const raw = (body as { gameIds?: unknown } | undefined)?.gameIds;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_GAMES_PER_EMAIL) return null;
  if (!raw.every((value) => typeof value === 'string' && value.length > 0)) return null;
  return [...new Set(raw as string[])];
};

/** Language of the email: the sender's UI language, since recipients store none. */
const parseLocale = (body: unknown): string | undefined => {
  const raw = (body as { locale?: unknown } | undefined)?.locale;
  if (typeof raw !== 'string') return undefined;
  // A browser may report a region too, e.g. "cs-CZ".
  return raw.toLowerCase().startsWith('cs') ? 'cs' : 'en';
};

class AlreadyClaimed extends Error {}

/**
 * Finished games that no results email has mentioned yet - what the manager
 * picks from - and how many people an email would reach.
 */
export const listUnsentGames = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [games, recipients] = await Promise.all([
      prisma.game.findMany({
        where: { seasonId: id, status: 'COMPLETED', digestId: null },
        select: {
          id: true,
          date: true,
          round: true,
          homeScore: true,
          awayScore: true,
          confirmedAt: true,
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      summaryRecipients(id),
    ]);
    res.json({ games, recipientCount: recipients.length });
  } catch (error) {
    console.error('List unsent games error:', error);
    res.status(500).json({ error: 'Failed to fetch games to send' });
  }
};

/** What the email for the picked games would say, without sending anything. */
export const previewResultsEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const gameIds = parseGameIds(req.body);
    if (!gameIds) {
      res.status(400).json({ error: 'Pick at least one game' });
      return;
    }

    const summary = await buildGamesSummary(id, gameIds);
    if (!summary) {
      res.status(404).json({ error: 'None of these games is finished' });
      return;
    }
    res.json({ summary });
  } catch (error) {
    console.error('Preview results email error:', error);
    res.status(500).json({ error: 'Failed to build the results email' });
  }
};

/**
 * Sends the email for the picked games to the manager alone, so they can see
 * it in a real inbox first. Nothing is recorded and the games stay unsent.
 */
export const sendTestResultsEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const gameIds = parseGameIds(req.body);
    if (!gameIds) {
      res.status(400).json({ error: 'Pick at least one game' });
      return;
    }

    const me = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true, email: true },
    });
    if (!me) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }

    const summary = await buildGamesSummary(id, gameIds);
    if (!summary) {
      res.status(404).json({ error: 'None of these games is finished' });
      return;
    }

    const sent = await emailService.sendRoundSummaryEmail(me.email, me.name, summary, parseLocale(req.body));
    if (!sent) {
      res.status(502).json({ error: 'The test email could not be delivered' });
      return;
    }
    res.json({ to: me.email });
  } catch (error) {
    console.error('Send test results email error:', error);
    res.status(500).json({ error: 'Failed to send the test email' });
  }
};

/**
 * Mails the picked games to everyone in the season.
 *
 * The games are claimed for this email before anything is sent: a double click,
 * or two managers at once, finds them taken and is refused instead of putting a
 * second copy in every inbox. If not a single delivery succeeds the claim is
 * released, so the games are offered again rather than marked as sent to nobody.
 */
export const sendResultsEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const gameIds = parseGameIds(req.body);
    if (!gameIds) {
      res.status(400).json({ error: 'Pick at least one game' });
      return;
    }

    let digestId: string;
    try {
      digestId = await prisma.$transaction(async (tx) => {
        const digest = await tx.seasonDigest.create({
          data: { seasonId: id, round: null, recipientCount: 0, sentById: req.user?.id ?? null },
        });
        const claimed = await tx.game.updateMany({
          where: { id: { in: gameIds }, seasonId: id, status: 'COMPLETED', digestId: null },
          data: { digestId: digest.id },
        });
        if (claimed.count !== gameIds.length) throw new AlreadyClaimed();
        return digest.id;
      });
    } catch (error) {
      if (error instanceof AlreadyClaimed) {
        res.status(409).json({ error: 'Some of these games have already been sent or are not finished' });
        return;
      }
      throw error;
    }

    const summary = await buildGamesSummary(id, gameIds);
    const recipients = await summaryRecipients(id);
    let delivered = 0;
    for (const recipient of recipients) {
      const sent = await emailService.sendRoundSummaryEmail(
        recipient.email,
        recipient.name,
        summary!,
        parseLocale(req.body)
      );
      if (sent) delivered++;
    }

    if (recipients.length > 0 && delivered === 0) {
      // Deleting the record unlinks its games (ON DELETE SET NULL).
      await prisma.seasonDigest.delete({ where: { id: digestId } });
      res.status(502).json({ error: 'The email could not be delivered to anyone' });
      return;
    }

    const record = await prisma.seasonDigest.update({
      where: { id: digestId },
      data: { recipientCount: delivered, sentAt: new Date() },
    });

    await recordAudit({
      entityType: 'Season',
      entityId: id,
      action: 'CREATE',
      after: { gameIds, recipientCount: delivered, attempted: recipients.length },
      reason: 'Results email sent',
      actorId: req.user?.id ?? null,
    });

    res.json({ games: gameIds.length, attempted: recipients.length, delivered, sentAt: record.sentAt });
  } catch (error) {
    console.error('Send results email error:', error);
    res.status(500).json({ error: 'Failed to send the results email' });
  }
};

/**
 * The picked games as a PNG card, for the manager to share into a team chat.
 * Sharing is not sending: the games stay offered for the email.
 */
export const resultsImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const gameIds = parseGameIds(req.body);
    if (!gameIds) {
      res.status(400).json({ error: 'Pick at least one game' });
      return;
    }

    const summary = await buildGamesSummary(id, gameIds);
    if (!summary) {
      res.status(404).json({ error: 'None of these games is finished' });
      return;
    }

    const png = await renderResultsImage(summary, parseLocale(req.body) === 'en' ? 'en' : 'cs');
    res.type('image/png').set('Cache-Control', 'no-store').send(png);
  } catch (error) {
    console.error('Results image error:', error);
    res.status(500).json({ error: 'Failed to draw the results image' });
  }
};
