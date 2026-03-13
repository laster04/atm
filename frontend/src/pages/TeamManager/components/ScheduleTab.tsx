import type { Game } from '@types';
import { Card, CardContent, CardHeader, CardTitle } from "@components/base/card.tsx";
import { Badge } from "@components/base/badge.tsx";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface ScheduleTabProps {
	games: Game[];
	teamId: number;
}

export default function ScheduleTab({ games, teamId }: ScheduleTabProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();


	const upcomingGames = (games || [])
		.filter((g: Game) => g.status === 'SCHEDULED')
		.reverse();

	const completedGames = games
		.filter((g) => g.status === 'COMPLETED')
		.sort((a, b) => {
			if (!a.date || !b.date) return 0;
			return new Date(b.date).getTime() - new Date(a.date).getTime();
		});
	return (
		<>
			<Card className="schedule-card">
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						{t('teamManagement.pwa.upcomingGames')}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{upcomingGames.length > 0 ? (
						upcomingGames.map((game: Game) => (
							<div
								key={game.id}
								className="game-item game-item-upcoming"
							>
								<div className="flex-1">
									<div className="game-item-title">
										{game.homeTeamId === teamId
											? `vs ${game.awayTeam?.name}`
											: `@ ${game.homeTeam?.name}`}
									</div>
									<div className="game-item-meta">
										{game.date ? new Date(game.date).toLocaleDateString() : t('admin.tabs.game.noDate')}
										{game.location && ` • ${game.location}`}
									</div>
								</div>
								<Badge variant={game.homeTeamId === teamId ? 'default' : 'outline'}>
									{game.homeTeamId === teamId ? t('teamManagement.pwa.home') : t('teamManagement.pwa.away')}
								</Badge>
							</div>
						))
					) : (
						<div className="text-center text-muted-foreground py-4">
							{t('teamDetail.games.noGames')}
						</div>
					)}
				</CardContent>
			</Card>
			<Card className="schedule-card mt-4 mb-8">
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						{t('teamManagement.pwa.pastGames')}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{completedGames.length > 0 ? (
						completedGames.map((game: Game) => {
							const isHome = game.homeTeamId === teamId;
							const teamScore = isHome ? game.homeScore : game.awayScore;
							const opponentScore = isHome ? game.awayScore : game.homeScore;
							const hasScore = teamScore != null && opponentScore != null;
							const isWin = hasScore && teamScore > opponentScore;
							const isDraw = hasScore && teamScore === opponentScore;

							return (
								<button
									key={game.id}
									className="game-item game-item-completed"
									onClick={() => navigate(`/team-management/${teamId}/game/${game.id}`)}
								>
									<div className="flex-1 text-left">
										<div className="game-item-title">
											{isHome
												? `vs ${game.awayTeam?.name}`
												: `@ ${game.homeTeam?.name}`}
										</div>
										<div className="game-item-meta">
											{game.date ? new Date(game.date).toLocaleDateString() : t('admin.tabs.game.noDate')}
											{game.location && ` • ${game.location}`}
										</div>
									</div>
									{hasScore && (
										<div className="flex items-center gap-2">
											<span className="game-score">
												{teamScore} : {opponentScore}
											</span>
											<Badge
												variant={isWin ? 'default' : isDraw ? 'secondary' : 'destructive'}
												className={isWin ? 'bg-green-600 hover:bg-green-700' : ''}
											>
												{isWin ? t('teamManagement.pwa.win') : isDraw ? t('teamManagement.pwa.draw') : t('teamManagement.pwa.loss')}
											</Badge>
										</div>
									)}
									<ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
								</button>
							);
						})
					) : (
						<div className="text-center text-muted-foreground py-4">
							{t('teamDetail.games.noGames')}
						</div>
					)}
				</CardContent>
			</Card>
		</>
		// <div className="pb-20">
		// 	<GamesList games={games} teamId={teamId} />
		// </div>
	);
}
