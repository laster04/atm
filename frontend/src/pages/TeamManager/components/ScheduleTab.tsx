import type { Game } from '@types';
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
								className="game-card game-card-upcoming group"
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
									className="game-card game-card-completed group"
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
											<div className="text-right">
												<div className="game-score-display">
													<span className="game-final-score">{teamScore}</span>
													<span className="game-score-separator">:</span>
													<span className="game-final-score">{opponentScore}</span>
												</div>
												{(() => {
													const p1team = isHome ? game.period1HomeScore : game.period1AwayScore;
													const p1opp = isHome ? game.period1AwayScore : game.period1HomeScore;
													const p2team = isHome ? game.period2HomeScore : game.period2AwayScore;
													const p2opp = isHome ? game.period2AwayScore : game.period2HomeScore;
													const p3team = isHome ? game.period3HomeScore : game.period3AwayScore;
													const p3opp = isHome ? game.period3AwayScore : game.period3HomeScore;
													if (p1team == null && p2team == null && p3team == null) return null;
													return (
														<div className="flex gap-2 text-xs text-gray-400 justify-end mt-1">
															{p1team != null && <span>P1: {p1team}-{p1opp}</span>}
															{p2team != null && <span>P2: {p2team}-{p2opp}</span>}
															{p3team != null && <span>P3: {p3team}-{p3opp}</span>}
														</div>
													);
												})()}
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
