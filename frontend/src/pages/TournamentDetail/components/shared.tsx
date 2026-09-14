import type { Tournament, TournamentGame, TournamentStanding, TournamentTeam } from '@types';

/** Tennis names its entrants players and its scores games; everything else teams and goals. */
export type SportContext = 'TENNIS' | undefined;

export const sportContext = (tournament: Tournament | null): SportContext =>
	tournament?.series?.sportType === 'TENNIS' ? 'TENNIS' : undefined;

export const isPlayed = (game: TournamentGame): boolean =>
	game.status === 'COMPLETED' && game.homeScore != null && game.awayScore != null;

/** The teams of one group in the order they were entered, which the matrix keeps. */
export const groupTeams = (tournament: Tournament, groupId: string): TournamentTeam[] =>
	(tournament.groups?.find((group) => group.id === groupId)?.teams ?? []).map((entry) => entry.team);

/**
 * Teams that went through to the playoff: whoever appears in a knockout game.
 * Nothing is stored about how many qualify, so the bracket itself is the record.
 */
export const qualifiedTeamIds = (games: TournamentGame[]): Set<string> =>
	new Set(
		games
			.filter((game) => game.phase !== 'GROUP')
			.flatMap((game) => [game.homeTeamId, game.awayTeamId])
			.filter((id): id is string => !!id)
	);

/** "A1", "B2": a team's group and its place there, as the bracket labels seeds. */
export const seedLabels = (
	tournament: Tournament,
	standings: Record<string, TournamentStanding[]>
): Map<string, string> => {
	const labels = new Map<string, string>();
	for (const group of tournament.groups ?? []) {
		(standings[group.id] ?? []).forEach((row, index) => labels.set(row.teamId, `${group.name}${index + 1}`));
	}
	return labels;
};

const MEDAL: Record<number, string> = {
	1: 'bg-brand text-brand-ink',
	2: 'bg-border text-subtle-foreground',
	3: 'bg-warning-soft text-warning-strong',
};

/** Places one to three get a coloured disc, the rest a plain number. */
export function RankMark({ rank }: { rank: number }) {
	const tone = MEDAL[rank];
	if (!tone) {
		return <span className="inline-flex w-[22px] justify-center font-bold text-muted-foreground">{rank}</span>;
	}
	return (
		<span className={`inline-flex size-[22px] items-center justify-center rounded-full text-[11px] font-bold ${tone}`}>
			{rank}
		</span>
	);
}

/** Won–lost, with draws in the middle only when the group has had any. */
export const record = (row: TournamentStanding, withDraws: boolean): string =>
	withDraws ? `${row.won}–${row.drawn}–${row.lost}` : `${row.won}–${row.lost}`;
