import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Target, TrendingUp, Trophy } from 'lucide-react';
import { Game, GameStatus, Standing, TopScorer } from '@types';
import { gameStatisticApi } from '@/services/api';
import { mapArchivedPlayerStat } from '@/utils/archivedStats';
import { Panel, StatTile, TeamCrest } from '@/components/public';
import { FilterTimeEnum, GameSchedule } from './GameSchedule';
import TopScorers from './TopScorers';

interface StatsOverviewProps {
	seasonId: string;
	standings: Standing[];
	games: Game[];
	archived?: boolean;
}

export function StatsOverview({ seasonId, standings, games, archived }: StatsOverviewProps) {
	const { t } = useTranslation();
	const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
	const [loadingScorers, setLoadingScorers] = useState(true);

	useEffect(() => {
		setLoadingScorers(true);
		const request = archived
			? gameStatisticApi.getArchivedPlayerStats(seasonId).then((res) => res.data.slice(0, 5).map(mapArchivedPlayerStat))
			: gameStatisticApi.getTopScorersBySeason(seasonId, 5).then((res) => res.data);
		request
			.then((data) => setTopScorers(data))
			.catch((error) => console.error('Failed to fetch top scorers:', error))
			.finally(() => setLoadingScorers(false));
	}, [seasonId, archived]);

	const leader = standings[0];
	const completed = games.filter((game) => game.status === GameStatus.COMPLETED);
	const goals = completed.reduce((sum, game) => sum + (game.homeScore ?? 0) + (game.awayScore ?? 0), 0);

	return (
		<div className="flex flex-col gap-5">
			<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
				<StatTile
					label={t('seasonDetail.overview.gamePlayed')}
					value={completed.length}
					caption={t('seasonDetail.overview.outOfTotal', { count: games.length })}
					icon={<CalendarDays className="size-4.5" />}
					progress={games.length ? completed.length / games.length : 0}
				/>
				<StatTile
					label={t('seasonDetail.overview.leader')}
					value={
						leader?.team ? (
							<span className="flex items-center gap-2.5 text-xl">
								<TeamCrest team={leader.team} size={30} />
								<span className="truncate">{leader.team.name}</span>
							</span>
						) : '—'
					}
					caption={t('seasonDetail.overview.leaderPoints', { points: leader?.points ?? 0 })}
					icon={<Trophy className="size-4.5 text-brand" />}
				/>
				<StatTile
					label={t('seasonDetail.overview.scoredTotal')}
					value={standings.reduce((sum, row) => sum + row.goalsFor, 0)}
					caption={t('seasonDetail.overview.leagueWide')}
					icon={<Target className="size-4.5" />}
				/>
				<StatTile
					label={t('seasonDetail.overview.avgGoalsPerGame')}
					value={completed.length ? (goals / completed.length).toFixed(1) : '0.0'}
					caption={t('seasonDetail.overview.thisSeason')}
					icon={<TrendingUp className="size-4.5 text-success" />}
				/>
			</div>

			<div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
				<Panel flush title={t('seasonDetail.overview.upcomingGames')}>
					<GameSchedule filter={FilterTimeEnum.UPCOMING} games={games} />
				</Panel>
				<Panel
					flush
					title={t('seasonDetail.overview.topScorers')}
					description={t('seasonDetail.overview.leagueLeadersDescription')}
				>
					<TopScorers topScorers={topScorers} loading={loadingScorers} />
				</Panel>
			</div>
		</div>
	);
}
