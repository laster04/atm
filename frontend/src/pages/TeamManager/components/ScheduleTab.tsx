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
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-base">
							{t('teamManagement.pwa.upcomingGames')}
						</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					{upcomingGames.length > 0 ? (
						upcomingGames.map((game: Game) => (
							<div
								key={game.id}
								className="flex items-center gap-3 p-3 border rounded-lg"
							>
								<div className="flex-1">
									<div className="font-medium text-sm">
										{game.homeTeamId === teamId
											? `vs ${game.awayTeam?.name}`
											: `@ ${game.homeTeam?.name}`}
									</div>
									<div className="text-xs text-muted-foreground">
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
			<Card className="mt-3 mb-8">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-base">
							{t('teamManagement.pwa.pastGames')}
						</CardTitle>
					</div>
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
								<div
									key={game.id}
									className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
									onClick={() => navigate(`/team-management/${teamId}/game/${game.id}`)}
								>
									<div className="flex-1">
										<div className="font-medium text-sm">
											{isHome
												? `vs ${game.awayTeam?.name}`
												: `@ ${game.homeTeam?.name}`}
										</div>
										<div className="text-xs text-muted-foreground">
											{game.date ? new Date(game.date).toLocaleDateString() : t('admin.tabs.game.noDate')}
											{game.location && ` • ${game.location}`}
										</div>
									</div>
									{hasScore && (
										<div className="flex items-center gap-2">
											<span className="font-bold text-lg">
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
									<ChevronRight className="h-4 w-4 text-muted-foreground" />
								</div>
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
