import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext.tsx';
import { gameApi, playerApi, gameStatisticApi } from '@/services/api';

import { Card, CardContent, CardHeader, CardTitle } from "@components/base/card.tsx";
import { Button } from "@components/base/button.tsx";
import { Input } from "@components/base/input.tsx";
import { Checkbox } from "@components/base/checkbox.tsx";
import { Label } from "@components/base/label.tsx";
import { Game, Player, GameStatistic } from "@types";

interface PlayerStatForm {
	playerId: number;
	playerName: string;
	playerNumber: number | null;
	played: boolean;
	goals: number;
	assists: number;
	existingStatId?: number;
}

export default function GameStatisticPage(): React.JSX.Element {
	const { id } = useParams<{ id: string }>();
	const { t } = useTranslation();
	const { isAdmin, isSeasonManager } = useAuth();
	const canEdit = isAdmin() || isSeasonManager();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [game, setGame] = useState<Game | null>(null);
	const [homeTeamStats, setHomeTeamStats] = useState<PlayerStatForm[]>([]);
	const [awayTeamStats, setAwayTeamStats] = useState<PlayerStatForm[]>([]);

	useEffect(() => {
		if (!id) return;

		const fetchData = async () => {
			setLoading(true);
			try {
				const [gameResp, existingStatsResp] = await Promise.all([
					gameApi.getById(id),
					gameStatisticApi.getByGame(id)
				]);

				const gameData = gameResp.data;
				setGame(gameData);

				const existingStats = existingStatsResp.data;
				const statsMap = new Map<number, GameStatistic>();
				existingStats.forEach(stat => statsMap.set(stat.playerId, stat));

				// Fetch players for both teams
				const [homePlayersResp, awayPlayersResp] = await Promise.all([
					playerApi.getByTeam(gameData.homeTeamId),
					playerApi.getByTeam(gameData.awayTeamId)
				]);

				// Initialize form state for home team
				const homeStats: PlayerStatForm[] = homePlayersResp.data.map((player: Player) => {
					const existingStat = statsMap.get(player.id);
					return {
						playerId: player.id,
						playerName: player.name,
						playerNumber: player.number ?? null,
						played: !!existingStat,
						goals: existingStat?.goals ?? 0,
						assists: existingStat?.assists ?? 0,
						existingStatId: existingStat?.id
					};
				});

				// Initialize form state for away team
				const awayStats: PlayerStatForm[] = awayPlayersResp.data.map((player: Player) => {
					const existingStat = statsMap.get(player.id);
					return {
						playerId: player.id,
						playerName: player.name,
						playerNumber: player.number ?? null,
						played: !!existingStat,
						goals: existingStat?.goals ?? 0,
						assists: existingStat?.assists ?? 0,
						existingStatId: existingStat?.id
					};
				});

				setHomeTeamStats(homeStats);
				setAwayTeamStats(awayStats);
			} catch (error) {
				toast.error(t('gameStatistic.fetchError', 'Failed to fetch game data'));
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [id, t]);

	const updatePlayerStat = (
		team: 'home' | 'away',
		playerId: number,
		field: keyof PlayerStatForm,
		value: boolean | number
	) => {
		const setter = team === 'home' ? setHomeTeamStats : setAwayTeamStats;
		setter(prev => prev.map(stat =>
			stat.playerId === playerId ? { ...stat, [field]: value } : stat
		));
	};

	const handleSubmit = async () => {
		if (!id) return;

		setSaving(true);
		try {
			const allStats = [...homeTeamStats, ...awayTeamStats];

			for (const stat of allStats) {
				if (stat.played) {
					// Player participated - create or update
					if (stat.existingStatId) {
						await gameStatisticApi.update(stat.existingStatId, {
							goals: stat.goals,
							assists: stat.assists
						});
					} else {
						await gameStatisticApi.create(id, {
							playerId: stat.playerId,
							goals: stat.goals,
							assists: stat.assists
						});
					}
				} else if (stat.existingStatId) {
					// Player didn't participate but has existing stat - delete it
					await gameStatisticApi.delete(stat.existingStatId);
				}
			}

			toast.success(t('gameStatistic.saveSuccess', 'Statistics saved successfully'));

			// Refresh data to get updated IDs
			const existingStatsResp = await gameStatisticApi.getByGame(id);
			const statsMap = new Map<number, GameStatistic>();
			existingStatsResp.data.forEach(stat => statsMap.set(stat.playerId, stat));

			setHomeTeamStats(prev => prev.map(stat => ({
				...stat,
				existingStatId: statsMap.get(stat.playerId)?.id
			})));
			setAwayTeamStats(prev => prev.map(stat => ({
				...stat,
				existingStatId: statsMap.get(stat.playerId)?.id
			})));
		} catch (error) {
			toast.error(t('gameStatistic.saveError', 'Failed to save statistics'));
		} finally {
			setSaving(false);
		}
	};

	const renderPlayerRow = (stat: PlayerStatForm, team: 'home' | 'away') => (
		<div key={stat.playerId} className="flex items-center gap-3 py-2 border-b last:border-b-0">
			<Checkbox
				id={`played-${stat.playerId}`}
				checked={stat.played}
				onCheckedChange={(checked) => updatePlayerStat(team, stat.playerId, 'played', !!checked)}
			/>
			<div className="flex-1 min-w-0">
				<Label htmlFor={`played-${stat.playerId}`} className="cursor-pointer">
					{stat.playerNumber && (
						<span className="text-muted-foreground mr-2">#{stat.playerNumber}</span>
					)}
					{stat.playerName}
				</Label>
			</div>
			<div className="flex items-center gap-2">
				<div className="flex flex-col items-center">
					<Label className="text-xs text-muted-foreground mb-1">
						{t('gameStatistic.goals', 'Goals')}
					</Label>
					<Input
						type="number"
						min={0}
						value={stat.goals}
						onChange={(e) => updatePlayerStat(team, stat.playerId, 'goals', parseInt(e.target.value) || 0)}
						disabled={!stat.played}
						className="w-16 text-center"
					/>
				</div>
				<div className="flex flex-col items-center">
					<Label className="text-xs text-muted-foreground mb-1">
						{t('gameStatistic.assists', 'Assists')}
					</Label>
					<Input
						type="number"
						min={0}
						value={stat.assists}
						onChange={(e) => updatePlayerStat(team, stat.playerId, 'assists', parseInt(e.target.value) || 0)}
						disabled={!stat.played}
						className="w-16 text-center"
					/>
				</div>
			</div>
		</div>
	);

	if (loading) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">
				<Loader2 className="h-8 w-8 animate-spin mx-auto" />
			</div>
		);
	}

	if (!game) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">
				{t('gameStatistic.notFound', 'Game not found')}
			</div>
		);
	}

	if (!canEdit) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">
				{t('common.unauthorized', 'You are not authorized to access this page')}
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center justify-center flex-1">
							<CardTitle className="text-sm sm:text-xl grid grid-cols-[1fr_auto_1fr] items-center gap-2">
								<div className="text-right">
									<div className="flex items-center justify-end gap-2">
										<div
											className="size-4 rounded-full border-2 border-white shadow-sm"
											style={{ backgroundColor: game.homeTeam?.primaryColor ?? '#808080' }}
										/>
										<span className="font-medium">{game.homeTeam?.name}</span>
									</div>
								</div>

								<div className="flex items-center gap-3 px-4">
									{game.status === 'SCHEDULED' ? (
										<span className="text-2xl font-medium text-muted-foreground">vs</span>
									) : (
										<>
											<span className="text-sm sm:text-3xl font-medium">{game.homeScore}</span>
											<span className="text-sm sm:text-xl text-muted-foreground">-</span>
											<span className="text-sm sm:text-3xl font-medium">{game.awayScore}</span>
										</>
									)}
								</div>

								<div className="text-left">
									<div className="flex items-center gap-2">
										<div
											className="size-4 rounded-full border-2 border-white shadow-sm"
											style={{ backgroundColor: game.awayTeam?.primaryColor || '#808080' }}
										/>
										<span className="font-medium">{game.awayTeam?.name}</span>
									</div>
								</div>
							</CardTitle>
						</div>
						<Button onClick={handleSubmit} disabled={saving}>
							{saving ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : (
								<Save className="h-4 w-4 mr-2" />
							)}
							{t('common.save', 'Save')}
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid gap-5 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<div
										className="size-4 rounded-full"
										style={{ backgroundColor: game.homeTeam?.primaryColor ?? '#808080' }}
									/>
									{game.homeTeam?.name}
								</CardTitle>
							</CardHeader>
							<CardContent>
								{homeTeamStats.length === 0 ? (
									<p className="text-muted-foreground text-center py-4">
										{t('gameStatistic.noPlayers', 'No players in this team')}
									</p>
								) : (
									<div className="space-y-1">
										{homeTeamStats.map(stat => renderPlayerRow(stat, 'home'))}
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<div
										className="size-4 rounded-full"
										style={{ backgroundColor: game.awayTeam?.primaryColor ?? '#808080' }}
									/>
									{game.awayTeam?.name}
								</CardTitle>
							</CardHeader>
							<CardContent>
								{awayTeamStats.length === 0 ? (
									<p className="text-muted-foreground text-center py-4">
										{t('gameStatistic.noPlayers', 'No players in this team')}
									</p>
								) : (
									<div className="space-y-1">
										{awayTeamStats.map(stat => renderPlayerRow(stat, 'away'))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
