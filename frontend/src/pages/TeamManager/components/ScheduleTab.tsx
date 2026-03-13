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
		<div className="schedule-container">
			{/* Upcoming Games Section */}
			<section className="schedule-section">
				<div className="schedule-section-header">
					<h2 className="schedule-section-title">📅 {t('teamManagement.pwa.upcomingGames')}</h2>
					<p className="schedule-section-subtitle">{upcomingGames.length} games scheduled</p>
				</div>

				<div className="games-list">
					{upcomingGames.length > 0 ? (
						upcomingGames.map((game: Game, index) => (
							<div
								key={game.id}
								className="game-card game-card-upcoming"
								style={{ animation: `slideIn 0.3s ease-out ${index * 0.05}s backwards` }}
							>
								<div className="game-card-header">
									<div className="game-opponent">
										<h3 className="game-opponent-name">
											{game.homeTeamId === teamId
												? `vs ${game.awayTeam?.name}`
												: `@ ${game.homeTeam?.name}`}
										</h3>
										<Badge className="game-location-badge" variant={game.homeTeamId === teamId ? 'default' : 'outline'}>
											{game.homeTeamId === teamId ? t('teamManagement.pwa.home') : t('teamManagement.pwa.away')}
										</Badge>
									</div>
								</div>

								<div className="game-card-meta">
									<span className="game-date">
										📍 {game.date ? new Date(game.date).toLocaleDateString() : t('admin.tabs.game.noDate')}
									</span>
									{game.location && <span className="game-location">🏟️ {game.location}</span>}
								</div>
							</div>
						))
					) : (
						<div className="schedule-empty-state">
							<div className="empty-icon">🎯</div>
							<p className="empty-message">{t('teamDetail.games.noGames')}</p>
							<p className="empty-submessage">No upcoming games scheduled</p>
						</div>
					)}
				</div>
			</section>

			{/* Completed Games Section */}
			<section className="schedule-section mt-8">
				<div className="schedule-section-header">
					<h2 className="schedule-section-title">🏆 {t('teamManagement.pwa.pastGames')}</h2>
					<p className="schedule-section-subtitle">{completedGames.length} games played</p>
				</div>

				<div className="games-list">
					{completedGames.length > 0 ? (
						completedGames.map((game: Game, index) => {
							const isHome = game.homeTeamId === teamId;
							const teamScore = isHome ? game.homeScore : game.awayScore;
							const opponentScore = isHome ? game.awayScore : game.homeScore;
							const hasScore = teamScore != null && opponentScore != null;
							const isWin = hasScore && teamScore > opponentScore;
							const isDraw = hasScore && teamScore === opponentScore;
							const resultColor = isWin ? 'win' : isDraw ? 'draw' : 'loss';

							return (
								<button
									key={game.id}
									className="game-card game-card-completed"
									onClick={() => navigate(`/team-management/${teamId}/game/${game.id}`)}
									style={{ animation: `slideIn 0.3s ease-out ${index * 0.05}s backwards` }}
								>
									<div className="game-card-header">
										<div className="game-opponent">
											<h3 className="game-opponent-name">
												{isHome
													? `vs ${game.awayTeam?.name}`
													: `@ ${game.homeTeam?.name}`}
											</h3>
											{hasScore && (
												<Badge className={`game-result-badge game-result-${resultColor}`}>
													{isWin ? t('teamManagement.pwa.win') : isDraw ? t('teamManagement.pwa.draw') : t('teamManagement.pwa.loss')}
												</Badge>
											)}
										</div>

										{hasScore && (
											<div className="game-score-display">
												<span className="game-final-score">{teamScore}</span>
												<span className="game-score-separator">:</span>
												<span className="game-final-score">{opponentScore}</span>
											</div>
										)}
									</div>

									<div className="game-card-meta">
										<span className="game-date">
											📍 {game.date ? new Date(game.date).toLocaleDateString() : t('admin.tabs.game.noDate')}
										</span>
										{game.location && <span className="game-location">🏟️ {game.location}</span>}
									</div>

									<ChevronRight className="game-card-icon" />
								</button>
							);
						})
					) : (
						<div className="schedule-empty-state">
							<div className="empty-icon">📊</div>
							<p className="empty-message">{t('teamDetail.games.noGames')}</p>
							<p className="empty-submessage">No completed games yet</p>
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
