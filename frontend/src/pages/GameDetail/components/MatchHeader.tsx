import { useTranslation } from 'react-i18next';
import SharedMatchHeader from '@/components/match/MatchHeader';
import type { SportProfile } from '@/utils/sportProfiles';
import type { GameDetail } from '@types';

/** The status chip: live, played, waiting for confirmation, or what else the game is. */
const statusChip = (game: GameDetail['game']): { key: string; className: string } => {
	if (game.status === 'IN_PROGRESS') return { key: 'live', className: 'bg-destructive-strong text-white' };
	if (game.status === 'COMPLETED') {
		return game.confirmed
			? { key: 'played', className: 'bg-success-soft text-success-strong' }
			: { key: 'waiting', className: 'bg-warning-soft text-warning-strong' };
	}
	return { key: game.status.toLowerCase(), className: 'bg-white/10 text-white' };
};

/** A league game's header: league, season and round above, table places under the teams. */
export default function MatchHeader({ detail, profile }: { detail: GameDetail; profile: SportProfile }) {
	const { t } = useTranslation();
	const { game, league, season } = detail;
	const chip = statusChip(game);
	const rankOf = (teamId: string) => detail.table.rows.find((row) => row.team.id === teamId)?.rank;
	const note = (teamId: string) => {
		const rank = rankOf(teamId);
		return rank ? t('gameDetail.rank', { rank }) : null;
	};

	return (
		<SharedMatchHeader
			crumbs={[
				{ label: league.name, to: `/leagues/${league.id}` },
				{ label: season.name, to: `/season-detail/${season.id}` },
				...(game.round != null || game.playoff
					? [{ label: game.playoff ? t('gameDetail.playoff') : t('gameDetail.round', { n: game.round }) }]
					: []),
			]}
			home={{ team: game.homeTeam, href: `/teams/${game.homeTeam.id}`, note: note(game.homeTeam.id) }}
			away={{ team: game.awayTeam, href: `/teams/${game.awayTeam.id}`, note: note(game.awayTeam.id) }}
			homeScore={game.homeScore}
			awayScore={game.awayScore}
			scored={game.homeScore != null && game.awayScore != null && game.status !== 'SCHEDULED'}
			parts={profile.scoreIsPartsWon ? null : game.periodScores}
			status={{ label: t(`gameDetail.status.${chip.key}`), className: chip.className }}
			date={game.date}
			location={game.location}
		/>
	);
}
