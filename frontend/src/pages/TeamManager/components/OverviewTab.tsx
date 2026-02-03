import { useTranslation } from 'react-i18next';
import { ChevronRight, Plus, Users } from 'lucide-react';
import { Button } from '@components/base/button';
import { Badge } from '@components/base/badge';
import { Card, CardTitle, CardHeader, CardContent } from '@/components/base/card';
import type { Game, Standing, Team } from '@types';

interface OverviewTabProps {
	team: Team;
	standing?: Standing;
	onTabChange: (tab: 'roster' | 'schedule') => void;
	onAddPlayer: () => void;
}

export default function OverviewTab({
	team,
	standing,
	onTabChange,
	onAddPlayer,
}: OverviewTabProps) {
	const { t } = useTranslation();

	const upcomingGames = (team.games || [])
		.filter((g: Game) => g.status === 'SCHEDULED')
		.slice(0, 3);

	return (
		<div className="space-y-4 pb-20">
			{/* Quick Stats */}
			<div className="grid grid-cols-3 gap-3">
				<Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-green-900">
							{standing?.wins ?? 0}
						</div>
						<div className="text-xs text-green-700 mt-1">
							{t('teamManagement.pwa.wins')}
						</div>
					</CardContent>
				</Card>
				<Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-red-900">
							{standing?.losses ?? 0}
						</div>
						<div className="text-xs text-red-700 mt-1">
							{t('teamManagement.pwa.losses')}
						</div>
					</CardContent>
				</Card>
				<Card className="bg-gradient-to-br from-primary/10 to-primary/20 border-primary/30">
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold">
							{standing?.points ?? 0}
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							{t('teamManagement.pwa.points')}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Upcoming Games */}
			<Card>
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
								className="flex items-center gap-3 p-3 border rounded-lg"
							>
								<div className="flex-1">
									<div className="font-medium text-sm">
										{game.homeTeamId === team.id
											? `vs ${game.awayTeam?.name}`
											: `@ ${game.homeTeam?.name}`}
									</div>
									<div className="text-xs text-muted-foreground">
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
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						{t('teamManagement.pwa.quickActions')}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<Button
						className="w-full justify-start h-12"
						onClick={onAddPlayer}
					>
						<Plus className="size-4 mr-2" />
						{t('teamManagement.pwa.addPlayer')}
					</Button>
					<Button
						variant="outline"
						className="w-full justify-start h-12"
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
