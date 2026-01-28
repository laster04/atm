import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/base/card";

import { Calendar, Target, TrendingUp, Trophy } from 'lucide-react';
import { Game, GameStatus, Standing } from "@types";
import { useTranslation } from "react-i18next";
import { FilterTimeEnum, GameSchedule } from "@/pages/SeasonDetail/components/GameSchedule.tsx";
import { gameStatisticApi, type TopScorer } from '@/services/api';
import TopScorers from './TopScorers';

interface StatsOverviewProps {
	seasonId: number;
	standings: Standing[];
	games: Game[];
}

export function StatsOverview({ seasonId, standings, games }: StatsOverviewProps) {
	const { t } = useTranslation();
	const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
	const [loadingScorers, setLoadingScorers] = useState(true);

	useEffect(() => {
		setLoadingScorers(true);
		gameStatisticApi.getTopScorersBySeason(seasonId, 5)
			.then((res) => setTopScorers(res.data))
			.catch((err) => console.error('Failed to fetch top scorers:', err))
			.finally(() => setLoadingScorers(false));
	}, [seasonId]);

	const stats = [
		{
			title: t('seasonDetail.overview.gamePlayed'),
			value: games.filter(item => item.status == GameStatus.COMPLETED).length,
			icon: Calendar,
			description: t('seasonDetail.overview.outOfTotal', { count: games.length}),
		},
		{
			title: t('seasonDetail.overview.leader'),
			value: standings[0].team.name,
			icon: Trophy,
			description: t('seasonDetail.overview.leaderPoints', { points: standings[0].points}),
		},
		{
			title: t('seasonDetail.overview.scoredTotal'),
			value: standings.reduce((sum, item) => sum + item.goalsFor, 0),
			icon: Target,
			description: t('seasonDetail.overview.leagueWide'),
		},
		{
			title: t('seasonDetail.overview.avgGoalsPerGame'),
			value: (games
				.filter(item => item.status == GameStatus.COMPLETED)
				.reduce((sum, game) => sum + (game?.homeScore ?? 0) + (game?.awayScore ?? 0), 0)
				/ games.filter(item => item.status == GameStatus.COMPLETED).length).toFixed(1),
			icon: TrendingUp,
			description: t('seasonDetail.overview.thisSeason'),
		},
	];

	return (
		<>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{stats.map((stat) => (
					<Card key={stat.title}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm">{stat.title}</CardTitle>
							<stat.icon className="size-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-medium">{stat.value}</div>
							<p className="text-xs text-muted-foreground">{stat.description}</p>
						</CardContent>
					</Card>
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>{t('seasonDetail.overview.upcomingGames')}</CardTitle>
					</CardHeader>
					<CardContent>
						<GameSchedule filter={FilterTimeEnum.UPCOMING} games={games} />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t('seasonDetail.overview.topScorers')}</CardTitle>
						<CardDescription>{t('seasonDetail.overview.leagueLeadersDescription')}</CardDescription>
					</CardHeader>
					<CardContent>
						<TopScorers topScorers={topScorers} loading={loadingScorers} />
					</CardContent>
				</Card>
			</div>
		</>
	);
}
