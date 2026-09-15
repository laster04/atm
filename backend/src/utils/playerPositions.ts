import { PlayerPosition, SportType } from '@prisma/client';

/**
 * The positions a player may hold, per sport, in the order a form lists them.
 * A sport with no list (tennis, "other") has no positions at all.
 *
 * Mirrored in frontend/src/utils/playerPositions.ts; keep the two in step.
 */
export const SPORT_POSITIONS: Record<SportType, PlayerPosition[]> = {
  HOCKEY: ['GOALIE', 'DEFENDER', 'FORWARD'],
  FLOORBALL: ['GOALIE', 'DEFENDER', 'FORWARD'],
  FOOTBALL: ['GOALIE', 'DEFENDER', 'MIDFIELDER', 'FORWARD'],
  HANDBALL: ['GOALIE', 'WING', 'BACK', 'PIVOT'],
  BASKETBALL: ['GUARD', 'FORWARD', 'CENTER'],
  VOLLEYBALL: ['SETTER', 'OUTSIDE_HITTER', 'OPPOSITE', 'MIDDLE_BLOCKER', 'LIBERO'],
  TENNIS: [],
  OTHER: [],
};

/** Positions allowed for a team playing these sports (a team may sit in leagues of more than one). */
export function positionsForSports(sports: SportType[]): PlayerPosition[] {
  const allowed = new Set(sports.flatMap((sport) => SPORT_POSITIONS[sport]));
  return Object.values(PlayerPosition).filter((position) => allowed.has(position));
}

export type PositionCheck = { ok: true; value: PlayerPosition | null | undefined } | { ok: false; error: string };

/**
 * Validates a position from a request body against the sports it is for.
 * Undefined means "not sent" and passes through, so a partial update leaves
 * the stored position alone; an empty string or null clears it.
 */
export function checkPosition(value: unknown, sports: SportType[]): PositionCheck {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === '') return { ok: true, value: null };
  if (typeof value !== 'string' || !positionsForSports(sports).includes(value as PlayerPosition)) {
    return { ok: false, error: 'Invalid position for this sport' };
  }
  return { ok: true, value: value as PlayerPosition };
}
