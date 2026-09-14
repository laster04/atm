import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Player, Team, TopScorer } from '@types';
import { EmptyState, Panel } from '@/components/public';

interface RosterTableProps {
	topScorers: TopScorer[];
	players: Player[];
	team: Pick<Team, 'primaryColor'>;
}

/**
 * Everyone on the roster, not only the players who have scored: the statistics
 * are joined onto the squad list, so a player with no points still appears.
 */
export default function RosterTable({ topScorers, players, team }: RosterTableProps) {
	const { t } = useTranslation();
	const color = team.primaryColor || '#0F172A';

	const statsByPlayer = new Map(topScorers.map((scorer) => [scorer.player.id, scorer]));
	const roster = [...players].sort((a, b) => {
		const pointsA = statsByPlayer.get(a.id)?.points ?? -1;
		const pointsB = statsByPlayer.get(b.id)?.points ?? -1;
		return pointsB - pointsA || (a.number ?? 999) - (b.number ?? 999);
	});

	if (roster.length === 0) {
		return (
			<Panel title={t('teamDetail.roster', { count: 0 })}>
				<EmptyState title={t('teamDetail.noPlayers')} />
			</Panel>
		);
	}

	return (
		<Panel title={t('teamDetail.roster', { count: roster.length })}>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{roster.map((player) => {
					const stats = statsByPlayer.get(player.id);
					return (
						<Link
							key={player.id}
							to={`/players/${player.id}`}
							className="flex items-center gap-3 rounded-xl border border-border p-3.5 transition-colors hover:bg-muted/50"
						>
							<span
								className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
								style={{ backgroundColor: color }}
							>
								{player.number ?? '—'}
							</span>
							<div className="flex min-w-0 flex-col">
								<span className="truncate text-sm font-semibold">{player.name}</span>
								<span className="truncate text-xs text-muted-foreground">
									{player.position || t('teamDetail.noPosition')}
								</span>
							</div>
							<div className="ml-auto flex flex-col items-end">
								<span className="text-[15px] font-extrabold">{stats?.points ?? 0}</span>
								<span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
									{t('seasonDetail.overview.pointsShort')}
								</span>
							</div>
						</Link>
					);
				})}
			</div>
		</Panel>
	);
}
