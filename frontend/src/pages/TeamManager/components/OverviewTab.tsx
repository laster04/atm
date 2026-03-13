import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Users } from 'lucide-react';
import { Button } from '@components/base/button';
import { Badge } from '@components/base/badge';
import { Card, CardTitle, CardHeader, CardContent } from '@/components/base/card';
import type { Game, Standing, Team } from '@types';

interface OverviewTabProps {
	team: Team;
	standing?: Standing;
	onTabChange: (tab: 'roster' | 'schedule') => void;
}

export default function OverviewTab({
	team,
	standing,
	onTabChange,
}: OverviewTabProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const upcomingGames = (team.games || [])
		.filter((g: Game) => g.status === 'SCHEDULED')
		.slice(0, 3);

	return (
		<div className="space-y-4 pb-20">
			{/* Quick Stats */}
			<div className="grid grid-cols-3 gap-3">
				<Card className="stat-card stat-card-wins">
					<CardContent className="p-4 text-center">
						<div className="stat-value stat-value-wins">
							{standing?.wins ?? 0}
						</div>
						<div className="stat-label stat-label-wins">
							{t('teamManagement.pwa.wins')}
						</div>
					</CardContent>
				</Card>
				<Card className="stat-card stat-card-losses">
					<CardContent className="p-4 text-center">
						<div className="stat-value stat-value-losses">
							{standing?.losses ?? 0}
						</div>
						<div className="stat-label stat-label-losses">
							{t('teamManagement.pwa.losses')}
						</div>
					</CardContent>
				</Card>
				<Card className="stat-card stat-card-points">
					<CardContent className="p-4 text-center">
						<div className="stat-value stat-value-points">
							{standing?.points ?? 0}
						</div>
						<div className="stat-label stat-label-points">
							{t('teamManagement.pwa.points')}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Upcoming Games */}
			<Card className="overview-card">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-base">
							{t('teamManagement.pwa.upcomingGames')}
						</CardTitle>
						<Button
							variant="ghost"
							size="sm"
							className="text-primary"
							onClick={() => onTabChange('schedule')}
						>
							{t('teamManagement.pwa.viewAll')}
							<ChevronRight className="size-4 ml-1" />
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					{upcomingGames.length > 0 ? (
						upcomingGames.map((game: Game) => (
							<div
								key={game.id}
								className="game-preview-item"
							>
								<div className="flex-1">
									<div className="game-preview-title">
										{game.homeTeamId === team.id
											? `vs ${game.awayTeam?.name}`
											: `@ ${game.homeTeam?.name}`}
									</div>
									<div className="game-preview-meta">
										{game.date ? new Date(game.date).toLocaleDateString() : t('admin.tabs.game.noDate')}
										{game.location && ` • ${game.location}`}
									</div>
								</div>
								<Badge variant={game.homeTeamId === team.id ? 'default' : 'outline'}>
									{game.homeTeamId === team.id ? t('teamManagement.pwa.home') : t('teamManagement.pwa.away')}
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

			{/* Quick Actions */}
			<Card className="overview-card">
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						{t('teamManagement.pwa.quickActions')}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<Button
						className="quick-action-button"
						onClick={() => navigate(`/team-management/${team.id}/player/new`)}
					>
						<Plus className="size-4 mr-2" />
						{t('teamManagement.pwa.addPlayer')}
					</Button>
					<Button
						variant="outline"
						className="quick-action-button"
						onClick={() => onTabChange('roster')}
					>
						<Users className="size-4 mr-2" />
						{t('teamManagement.pwa.manageRoster')}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
