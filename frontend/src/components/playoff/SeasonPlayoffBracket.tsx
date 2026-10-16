import { useTranslation } from 'react-i18next';
import type { PlayoffSeries, SeasonPlayoff } from '@types';
import { KnockoutBracket, type KnockoutCard } from '@/components/public';

/** Wins a best-of series takes: 2 of 3, 3 of 5. Mirrors services/playoff/bracket.ts. */
export const winsNeeded = (bestOf: number) => Math.floor(bestOf / 2) + 1;

/**
 * A season's play-off as a bracket: each series with its teams, or the table
 * places standing in for them until the regular season is settled, and the
 * series score once a game has been confirmed.
 */
export default function SeasonPlayoffBracket({ playoff }: { playoff: SeasonPlayoff }) {
	const { t } = useTranslation();

	const cards: KnockoutCard[] = playoff.series.map((series) => {
		const started = series.homeWins + series.awayWins > 0;
		const side = (team: PlayoffSeries['homeTeam'], seed: number | null, wins: number) => ({
			name: team?.name ?? null,
			placeholder: seed != null ? t('playoff.seed', { n: seed }) : t('playoff.tbd'),
			tag: seed != null ? String(seed) : undefined,
			score: started ? wins : null,
			won: !!team && series.winnerTeamId === team.id,
		});
		return {
			round: series.round,
			slot: series.slot,
			// Grey out the loser only once the series is over, not after every game.
			decided: series.winnerTeamId !== null,
			home: side(series.homeTeam, series.homeSeed, series.homeWins),
			away: side(series.awayTeam, series.awaySeed, series.awayWins),
			caption: series.bestOf > 1 ? t('playoff.bestOf', { count: winsNeeded(series.bestOf) }) : undefined,
		};
	});

	const final = playoff.series.find((series) => series.round === 'FINAL');

	return (
		<div className="flex flex-col">
			{!playoff.seedsResolved && (
				<p className="px-6 pt-5 text-[13px] text-muted-foreground">{t('playoff.seedsPending')}</p>
			)}
			<KnockoutBracket
				rounds={playoff.rounds}
				cards={cards}
				roundLabel={(round) => t(`playoff.rounds.${round}`)}
				byeLabel={t('playoff.bye')}
				champion={final?.winnerTeam ? { label: t('playoff.champion'), name: final.winnerTeam.name } : null}
			/>
		</div>
	);
}
