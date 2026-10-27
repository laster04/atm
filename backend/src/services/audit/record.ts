import { Prisma } from '@prisma/client';
import prisma, { type DbClient } from '../../config/database.js';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'CONFIRM'
  | 'REOPEN'
  // A game the two teams' matching results confirmed, without a person doing it.
  | 'AUTO_CONFIRM'
  // A scorer link for the game was handed out, or cancelled.
  | 'SCORER_LINK_CREATE'
  | 'SCORER_LINK_REVOKE';

export interface AuditEntry {
  entityType: string;
  entityId: string;
  action: AuditAction;
  /** The record as it stood before, and as it stands after. Either may be absent. */
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  actorId?: string | null;
}

/**
 * Writes one line of the administrative trail.
 *
 * Takes the transaction client when there is one, so the trail commits with the
 * change it describes and a rolled-back edit leaves no record of having
 * happened. Failing to write an audit line must never fail the request that
 * caused it, so the error is logged and swallowed: losing a line of history is
 * bad, rejecting a legitimate correction because of it is worse.
 */
export const recordAudit = async (
  entry: AuditEntry,
  tx: DbClient = prisma
): Promise<void> => {
  try {
    await tx.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        before: (entry.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        after: (entry.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        reason: entry.reason ?? null,
        actorId: entry.actorId ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit entry:', error);
  }
};

/**
 * The fields of a record worth keeping in the trail. Everything else on a row is
 * either noise (timestamps the trail already carries) or too large to store on
 * every edit.
 */
export const auditSnapshot = <T extends object>(row: T, fields: (keyof T)[]): Record<string, unknown> =>
  Object.fromEntries(fields.map(field => [field, row[field]]));
