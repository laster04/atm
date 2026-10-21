import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { recordAudit } from '../services/audit/record.js';
import {
  boolParam,
  csvFilename,
  dayRange,
  enumParam,
  parseListParams,
  sendCsv,
  totalRows,
  type CsvColumn,
} from '../services/admin/list.js';

const SORTABLE = ['name', 'email', 'createdAt', 'lastLoggedInAt'] as const;
const ROLES = ['ADMIN', 'USER'] as const;
/** What a user runs: a league, a team, a tournament series, anything, or nothing. */
const MANAGES = ['league', 'team', 'series', 'any', 'none'] as const;

const rowSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  emailVerified: true,
  lastLoggedInAt: true,
  createdAt: true,
  _count: { select: { managedLeagues: true, managedTeams: true, managedTournamentSeries: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof rowSelect }>;

const managesWhere = (manages: (typeof MANAGES)[number]): Prisma.UserWhereInput => {
  switch (manages) {
    case 'league': return { managedLeagues: { some: {} } };
    case 'team': return { managedTeams: { some: {} } };
    case 'series': return { managedTournamentSeries: { some: {} } };
    case 'any': return { OR: [{ managedLeagues: { some: {} } }, { managedTeams: { some: {} } }, { managedTournamentSeries: { some: {} } }] };
    case 'none': return { managedLeagues: { none: {} }, managedTeams: { none: {} }, managedTournamentSeries: { none: {} } };
  }
};

const columns: CsvColumn<UserRow>[] = [
  { header: 'id', value: (row) => row.id },
  { header: 'name', value: (row) => row.name },
  { header: 'email', value: (row) => row.email },
  { header: 'role', value: (row) => row.role },
  { header: 'active', value: (row) => row.active },
  { header: 'emailVerified', value: (row) => row.emailVerified },
  { header: 'leagues', value: (row) => row._count.managedLeagues },
  { header: 'teams', value: (row) => row._count.managedTeams },
  { header: 'series', value: (row) => row._count.managedTournamentSeries },
  { header: 'createdAt', value: (row) => row.createdAt },
  { header: 'lastLoggedInAt', value: (row) => row.lastLoggedInAt },
];

/**
 * GET /api/admin/users
 *
 * Filters: `q` (name or email), `active`, `verified`, `role`, `manages`,
 * `registeredFrom`/`registeredTo` (calendar days). `format=csv` exports the
 * same result.
 */
export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const params = parseListParams(req.query, SORTABLE, { sort: 'createdAt', dir: 'desc' });
    const active = boolParam(req.query.active);
    const verified = boolParam(req.query.verified);
    const role = enumParam(req.query.role, ROLES);
    const manages = enumParam(req.query.manages, MANAGES);
    const registered = dayRange(req.query.registeredFrom, req.query.registeredTo);

    const conditions: Prisma.UserWhereInput[] = [
      ...(params.q ? [{ OR: [
        { name: { contains: params.q, mode: 'insensitive' as const } },
        { email: { contains: params.q, mode: 'insensitive' as const } },
      ] }] : []),
      ...(active !== undefined ? [{ active }] : []),
      ...(verified !== undefined ? [{ emailVerified: verified }] : []),
      ...(role ? [{ role }] : []),
      ...(manages ? [managesWhere(manages)] : []),
      ...(registered ? [{ createdAt: registered }] : []),
    ];
    const where: Prisma.UserWhereInput = conditions.length ? { AND: conditions } : {};
    // Never-logged-in users sort last either way; ties break on id so pages don't overlap.
    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      { [params.sort]: params.sort === 'lastLoggedInAt' ? { sort: params.dir, nulls: 'last' } : params.dir },
      { id: 'asc' },
    ];

    if (params.csv) {
      await sendCsv(res, csvFilename('users'), columns, (skip, take) =>
        prisma.user.findMany({ where, select: rowSelect, orderBy, skip, take }));
      return;
    }

    const [rows, count] = await Promise.all([
      prisma.user.findMany({
        where,
        select: rowSelect,
        orderBy,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      totalRows('users', conditions.length > 0, () => prisma.user.count({ where })),
    ]);
    res.json({ rows, ...count, page: params.page, pageSize: params.pageSize });
  } catch (error) {
    console.error('Admin users list error:', error);
    if (res.headersSent) { res.end(); return; }
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/** GET /api/admin/users/:id — the detail panel: the account and what it runs. */
export const getUserDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        ...rowSelect,
        emailVerifiedAt: true,
        emailDigest: true,
        managedLeagues: {
          select: {
            id: true, name: true, sportType: true,
            seasons: { select: { id: true, name: true, status: true }, orderBy: { startDate: 'desc' } },
          },
          orderBy: { name: 'asc' },
        },
        managedTournamentSeries: {
          select: {
            id: true, name: true, sportType: true,
            tournaments: { select: { id: true, name: true, status: true }, orderBy: { startDate: 'desc' } },
          },
          orderBy: { name: 'asc' },
        },
        managedTeams: { select: { id: true, name: true, primaryColor: true }, orderBy: { name: 'asc' } },
        _count: {
          select: {
            ...rowSelect._count.select,
            playerProfiles: true,
            supportTickets: true,
            registrations: true,
          },
        },
      },
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (error) {
    console.error('Admin user detail error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

/**
 * POST /api/admin/users/active — `{ ids, active, reason }`
 *
 * Deactivates (or reactivates) one or many accounts. Each change is its own
 * audit line carrying the reason. An admin cannot lock themselves out.
 */
export const setUsersActive = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ids, active, reason } = req.body as { ids?: unknown; active?: unknown; reason?: unknown };
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((id) => typeof id === 'string')) {
      res.status(400).json({ error: 'ids must be a list of 1 to 500 user ids' });
      return;
    }
    if (typeof active !== 'boolean') { res.status(400).json({ error: 'active must be true or false' }); return; }
    const why = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
    if (!active && !why) { res.status(400).json({ error: 'A reason is required to deactivate' }); return; }
    if (!active && ids.includes(req.user!.id)) {
      res.status(400).json({ error: 'Cannot deactivate your own account' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const targets = await tx.user.findMany({
        where: { id: { in: ids as string[] }, active: !active },
        select: { id: true, email: true, name: true, active: true },
      });
      if (targets.length === 0) return 0;
      await tx.user.updateMany({ where: { id: { in: targets.map((user) => user.id) } }, data: { active } });
      for (const target of targets) {
        await recordAudit({
          entityType: 'User',
          entityId: target.id,
          action: 'UPDATE',
          before: { email: target.email, name: target.name, active: target.active },
          after: { email: target.email, name: target.name, active },
          reason: why || null,
          actorId: req.user!.id,
        }, tx);
      }
      return targets.length;
    });

    res.json({ updated });
  } catch (error) {
    console.error('Admin set users active error:', error);
    res.status(500).json({ error: 'Failed to update users' });
  }
};
