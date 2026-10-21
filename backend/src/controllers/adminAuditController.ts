import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { csvFilename, dayRange, parseListParams, sendCsv, totalRows, type CsvColumn } from '../services/admin/list.js';

const SORTABLE = ['createdAt'] as const;

const rowSelect = {
  id: true,
  entityType: true,
  entityId: true,
  action: true,
  before: true,
  after: true,
  reason: true,
  createdAt: true,
  actor: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AuditLogSelect;

type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof rowSelect }>;

const json = (value: Prisma.JsonValue) => (value === null ? '' : JSON.stringify(value));

const columns: CsvColumn<AuditRow>[] = [
  { header: 'createdAt', value: (row) => row.createdAt },
  { header: 'actor', value: (row) => row.actor?.email ?? '' },
  { header: 'entityType', value: (row) => row.entityType },
  { header: 'entityId', value: (row) => row.entityId },
  { header: 'action', value: (row) => row.action },
  { header: 'reason', value: (row) => row.reason },
  { header: 'before', value: (row) => json(row.before) },
  { header: 'after', value: (row) => json(row.after) },
];

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * GET /api/admin/audit
 *
 * Filters: `actor` (name or email), `actorId`, `entityType` (the section),
 * `entityId` (one record's history), `action`, `createdFrom`/`createdTo` (calendar days).
 * Newest first; `dir=asc` reverses.
 */
export const listAudit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const params = parseListParams(req.query, SORTABLE, { sort: 'createdAt', dir: 'desc' });
    const actor = text(req.query.actor);
    const actorId = text(req.query.actorId);
    const entityType = text(req.query.entityType);
    const entityId = text(req.query.entityId);
    const action = text(req.query.action);
    const period = dayRange(req.query.createdFrom, req.query.createdTo);

    const conditions: Prisma.AuditLogWhereInput[] = [
      ...(actor ? [{ actor: { OR: [
        { name: { contains: actor, mode: 'insensitive' as const } },
        { email: { contains: actor, mode: 'insensitive' as const } },
      ] } }] : []),
      ...(actorId ? [{ actorId }] : []),
      ...(entityType ? [{ entityType }] : []),
      ...(entityId ? [{ entityId }] : []),
      ...(action ? [{ action }] : []),
      ...(params.q ? [{ OR: [
        { reason: { contains: params.q, mode: 'insensitive' as const } },
        { entityId: params.q },
      ] }] : []),
      ...(period ? [{ createdAt: period }] : []),
    ];
    const where: Prisma.AuditLogWhereInput = conditions.length ? { AND: conditions } : {};
    const orderBy: Prisma.AuditLogOrderByWithRelationInput[] = [{ createdAt: params.dir }, { id: params.dir }];

    if (params.csv) {
      await sendCsv(res, csvFilename('audit'), columns, (skip, take) =>
        prisma.auditLog.findMany({ where, select: rowSelect, orderBy, skip, take }));
      return;
    }

    const [rows, count] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        select: rowSelect,
        orderBy,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      totalRows('audit_log', conditions.length > 0, () => prisma.auditLog.count({ where })),
    ]);
    res.json({ rows, ...count, page: params.page, pageSize: params.pageSize });
  } catch (error) {
    console.error('Admin audit list error:', error);
    if (res.headersSent) { res.end(); return; }
    res.status(500).json({ error: 'Failed to fetch the audit log' });
  }
};

/** GET /api/admin/audit/types — the sections the filter offers. */
export const listAuditTypes = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const types = await prisma.auditLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
    });
    res.json(types.map((row) => row.entityType));
  } catch (error) {
    console.error('Admin audit types error:', error);
    res.status(500).json({ error: 'Failed to fetch audit sections' });
  }
};
