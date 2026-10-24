import { GameStatus } from '@types';

/**
 * The match page for a game that is being or has been played; null for one
 * still to come, which has no page of its own yet.
 */
export const gamePage = (game: { id: string; status: GameStatus | string }): string | null =>
	game.status === GameStatus.COMPLETED || game.status === GameStatus.IN_PROGRESS ? `/games/${game.id}` : null;
