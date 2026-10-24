/**
 * The volleyball table's columns, as the Czech federation shows them: wins
 * 3:0 or 3:1 (V3), wins 3:2 (V2), losses 2:3 (P1), losses 0:3 or 1:3 (P0).
 * The server counts wins, losses and how many of them went to five sets.
 */
export interface VolleyballSplit {
	v3: number;
	v2: number;
	p1: number;
	p0: number;
}

export const volleyballSplit = (row: { wins: number; losses: number; otWins: number; otLosses: number }): VolleyballSplit => ({
	v3: row.wins - row.otWins,
	v2: row.otWins,
	p1: row.otLosses,
	p0: row.losses - row.otLosses,
});
