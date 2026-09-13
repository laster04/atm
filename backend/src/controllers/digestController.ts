import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { buildRoundSummary, summaryRecipients } from '../services/digest/roundSummary.js';
import { emailService } from '../services/emailService.js';
import { recordAudit } from '../services/audit/record.js';

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
      const sent = await emailService.sendRoundSummaryEmail(recipient.email, recipient.name, summary);
      if (sent) delivered++;
    }

    const record = await prisma.seasonDigest.upsert({
      where: { seasonId_round: { seasonId: id, round } },
      create: { seasonId: id, round, recipientCount: delivered, sentById: req.user?.id ?? null },
      update: { recipientCount: delivered, sentAt: new Date(), sentById: req.user?.id ?? null },
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
      include: { sentBy: { select: { id: true, name: true } } },
      orderBy: { round: 'asc' },
    });
    res.json(digests);
  } catch (error) {
    console.error('List digests error:', error);
    res.status(500).json({ error: 'Failed to fetch sent summaries' });
  }
};
