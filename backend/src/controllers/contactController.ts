import { Request, Response } from 'express';
import { Prisma, SupportCategory, SupportTicketStatus } from '@prisma/client';
import prisma from '../config/database.js';
import emailService from '../services/emailService.js';
import { recordAudit } from '../services/audit/record.js';
import { AuthRequest } from '../types/index.js';

const CATEGORIES = Object.values(SupportCategory);
const STATUSES = Object.values(SupportTicketStatus);

const SUBJECT_MAX = 160;
const MESSAGE_MAX = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------- rate limit

/**
 * At most this many messages per address per window. Kept in process memory:
 * it resets on restart and is per instance, which is enough to stop a form
 * being hammered without adding a dependency for one endpoint.
 */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const recentByIp = new Map<string, number[]>();

const overRateLimit = (ip: string, now = Date.now()): boolean => {
  const recent = (recentByIp.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    recentByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  recentByIp.set(ip, recent);
  return false;
};

/** For tests: forget every address. */
export const resetContactRateLimit = (): void => recentByIp.clear();

// ------------------------------------------------------------------ context

/**
 * Only these fields of the optional technical context are kept, each as a
 * short string. The page is stored without its query string, which can carry
 * tokens.
 */
const cleanContext = (raw: unknown): Prisma.InputJsonObject | undefined => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const input = raw as Record<string, unknown>;
  const text = (value: unknown, max: number) =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

  const page = text(input.page, 300)?.split(/[?#]/)[0];
  const context: Record<string, string | boolean> = {};
  if (page) context.page = page;
  const viewport = text(input.viewport, 20);
  if (viewport) context.viewport = viewport;
  const userAgent = text(input.userAgent, 300);
  if (userAgent) context.userAgent = userAgent;
  if (typeof input.signedIn === 'boolean') context.signedIn = input.signedIn;
  return Object.keys(context).length ? context : undefined;
};

// ------------------------------------------------------------------ notify

const notify = async (ticket: {
  id: string;
  category: string;
  subject: string;
  message: string;
  email: string | null;
  senderName: string | null;
}) => {
  const configured = process.env.SUPPORT_EMAIL?.split(',').map((address) => address.trim()).filter(Boolean);
  const recipients = configured?.length
    ? configured
    : (await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { email: true } })).map((u) => u.email);

  await Promise.all(recipients.map((to) => emailService.sendSupportTicketEmail(to, ticket)));
};

// ---------------------------------------------------------------- handlers

export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, subject, message, email, context, clientToken, website } = req.body ?? {};

    // Honeypot: the field is hidden from people. Anything filled in is a bot,
    // which gets the same answer as a person so it has nothing to learn from.
    if (typeof website === 'string' && website.trim() !== '') {
      res.status(202).json({ received: true });
      return;
    }

    const errors: Record<string, string> = {};
    if (!CATEGORIES.includes(category)) errors.category = 'invalid';
    const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
    if (cleanSubject.length < 3 || cleanSubject.length > SUBJECT_MAX) errors.subject = 'invalid';
    const cleanMessage = typeof message === 'string' ? message.trim() : '';
    if (cleanMessage.length < 10 || cleanMessage.length > MESSAGE_MAX) errors.message = 'invalid';
    const cleanEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
    if (cleanEmail && (cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail))) errors.email = 'invalid';
    if (typeof clientToken !== 'string' || clientToken.length < 8 || clientToken.length > 100) errors.clientToken = 'invalid';

    if (Object.keys(errors).length) {
      res.status(400).json({ error: 'Invalid message', fields: errors });
      return;
    }

    // A retry of a message that already arrived returns that message.
    const existing = await prisma.supportTicket.findUnique({ where: { clientToken }, select: { id: true } });
    if (existing) {
      res.status(200).json({ received: true, id: existing.id });
      return;
    }

    if (overRateLimit(req.ip ?? 'unknown')) {
      res.status(429).json({ error: 'Too many messages. Please try again later.' });
      return;
    }

    let ticket;
    try {
      ticket = await prisma.supportTicket.create({
        data: {
          category,
          subject: cleanSubject,
          message: cleanMessage,
          email: cleanEmail,
          context: cleanContext(context),
          clientToken,
          userId: req.user?.id ?? null,
        },
      });
    } catch (error) {
      // Two identical submits racing each other: the second loses on the
      // unique token and returns the first.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const first = await prisma.supportTicket.findUnique({ where: { clientToken }, select: { id: true } });
        res.status(200).json({ received: true, id: first?.id });
        return;
      }
      throw error;
    }

    notify({
      id: ticket.id,
      category: ticket.category,
      subject: ticket.subject,
      message: ticket.message,
      email: ticket.email,
      senderName: req.user?.name ?? null,
    }).catch((error) => console.error('Support notification error:', error));

    res.status(201).json({ received: true, id: ticket.id });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

export const listTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status;
    if (status !== undefined && !STATUSES.includes(status as SupportTicketStatus)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const tickets = await prisma.supportTicket.findMany({
      where: status ? { status: status as SupportTicketStatus } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json(tickets);
  } catch (error) {
    console.error('List support tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

export const updateTicketStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};
    if (!STATUSES.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const before = await prisma.supportTicket.findUnique({ where: { id }, select: { status: true } });
    if (!before) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await recordAudit({
      entityType: 'SupportTicket',
      entityId: id,
      action: 'UPDATE',
      before: { status: before.status },
      after: { status: ticket.status },
      actorId: req.user?.id ?? null,
    });

    res.json(ticket);
  } catch (error) {
    console.error('Update support ticket error:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
};
