import { useTranslation } from 'react-i18next';
import type { TournamentGame, TournamentGamePhase } from '@types';
import { EmptyState, KnockoutBracket, Panel } from '@/components/public';
import type { KnockoutCard, KnockoutRound } from '@/components/public';
import { isPlayed } from './shared';

/** Knockout rounds left to right; the bronze game hangs under the final. */
const ROUNDS: KnockoutRound[] = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];

interface PlayoffBracketProps {
	games: TournamentGame[];
	/** "A1"-style labels by team id, from the group tables. */
	seeds: Map<string, string>;
}

export default function PlayoffBracket({ games, seeds }: PlayoffBracketProps) {
	const { t } = useTranslation();
	const knockout = games.filter((game) => game.phase !== 'GROUP');

	if (knockout.length === 0) {
		return <EmptyState title={t('tournamentDetail.playoff.empty')} />;
	}

	// From the first round with a game through the final. A first round with
	// byes has fewer games than slots; the bracket leaves those slots empty.
	const first = ROUNDS.findIndex((phase) => knockout.some((game) => game.phase === phase));
	const rounds = ROUNDS.slice(first === -1 ? ROUNDS.length - 1 : first);
	const final = knockout.find((game) => game.phase === 'FINAL');
	const champion = final && isPlayed(final)
		? final.homeScore! > final.awayScore! ? final.homeTeam : final.awayTeam
		: null;

	const cards: KnockoutCard[] = knockout.map((game) => {
		const played = isPlayed(game);
		const side = (team: TournamentGame['homeTeam'], seed: number | null | undefined, score: number | null | undefined, won: boolean) => ({
			name: team?.name ?? null,
			// Before the groups finish a slot may only know which seed will fill it.
			placeholder: seed != null ? t('tm.common.seed', { n: seed }) : t('tm.common.tbd'),
			tag: team ? seeds.get(team.id) : undefined,
			score: played ? score : null,
			won,
		});
		return {
			round: game.phase as Exclude<TournamentGamePhase, 'GROUP'>,
			slot: game.bracketSlot ?? 0,
			decided: played,
			home: side(game.homeTeam, game.homeSeed, game.homeScore, played && game.homeScore! > game.awayScore!),
			away: side(game.awayTeam, game.awaySeed, game.awayScore, played && game.awayScore! > game.homeScore!),
		};
	});

	return (
		<Panel flush title={t('tournamentDetail.playoff.title')}>
			<KnockoutBracket
				rounds={rounds}
				cards={cards}
				roundLabel={(round) => t(`tournamentDetail.playoff.phases.${round}`)}
				byeLabel={t('playoff.bye')}
				champion={champion ? { label: t('tournamentDetail.playoff.champion'), name: champion.name } : null}
			/>
		</Panel>
	);
}
