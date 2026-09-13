import type { Standing } from '@types';

/**
 * How a row should read while games are being played.
 *
 * A team that is on the ice gets the full treatment - a tinted row and an arrow -
 * because the result being played is theirs to change. A team sitting at home
 * that is nonetheless being overtaken gets the arrow only: the move is real, but
 * colouring their row would suggest they are involved in something they are not.
 */
export interface LiveTone {
  /** Row background, or undefined to leave the row alone. */
  background?: string;
  /** 1 climbing, -1 dropping, 0 staying put. */
  direction: 0 | 1 | -1;
  /** Places gained or lost, always positive; 0 when staying put. */
  places: number;
  /** Whether this team is playing right now. */
  inPlay: boolean;
}

const UP = 'rgba(22, 101, 52, 0.09)';
const DOWN = 'rgba(153, 27, 27, 0.09)';
/** Playing, but the result as it stands changes nothing. */
const LEVEL = 'rgba(100, 116, 139, 0.07)';

export const liveTone = (row: Standing): LiveTone => {
  if (!row.live) return { direction: 0, places: 0, inPlay: false };

  const movement = row.live.movement;
  const direction = movement > 0 ? 1 : movement < 0 ? -1 : 0;

  return {
    background: row.inPlay ? (direction === 1 ? UP : direction === -1 ? DOWN : LEVEL) : undefined,
    direction,
    places: Math.abs(movement),
    inPlay: row.inPlay,
  };
};

/** True when anything in the table is being played, so the legend is worth showing. */
export const hasLiveGames = (standings: Standing[]): boolean =>
  standings.some((row) => row.inPlay);

/** How often a table with a game in progress re-reads itself, in milliseconds. */
export const LIVE_REFRESH_MS = 30_000;
