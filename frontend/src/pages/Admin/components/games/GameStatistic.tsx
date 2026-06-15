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
import { Game, Player, HockeyGameStatistic } from "@types";

interface PeriodScores {
	homeScore: number | null;
	awayScore: number | null;
	period1HomeScore: number | null;
	period1AwayScore: number | null;
	period2HomeScore: number | null;
	period2AwayScore: number | null;
	period3HomeScore: number | null;
	period3AwayScore: number | null;
}

interface PlayerStatForm {
	playerId: number;
	playerName: string;
	playerNumber: number | null;
	played: boolean;
	goals: number;
	assists: number;
	existingStatId?: number;
}

export default function HockeyGameStatisticPage(): React.JSX.Element {
	const { id } = useParams<{ id: string }>();
	const { t } = useTranslation();
	const { isAdmin, isSeasonManager, canManageTeam } = useAuth();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [game, setGame] = useState<Game | null>(null);
	const [periodScores, setPeriodScores] = useState<PeriodScores>({
		homeScore: null,
		awayScore: null,
		period1HomeScore: null,
		period1AwayScore: null,
		period2HomeScore: null,
		period2AwayScore: null,
		period3HomeScore: null,
		period3AwayScore: null,
	});
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
				setPeriodScores({
					homeScore: gameData.homeScore ?? null,
					awayScore: gameData.awayScore ?? null,
					period1HomeScore: gameData.period1HomeScore ?? null,
					period1AwayScore: gameData.period1AwayScore ?? null,
					period2HomeScore: gameData.period2HomeScore ?? null,
					period2AwayScore: gameData.period2AwayScore ?? null,
					period3HomeScore: gameData.period3HomeScore ?? null,
					period3AwayScore: gameData.period3AwayScore ?? null,
				});

				const existingStats = existingStatsResp.data;
				const statsMap = new Map<number, HockeyGameStatistic>();
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

	const canEditFull = isAdmin() || isSeasonManager();
	const canEditHome = canEditFull || canManageTeam(game?.homeTeam?.managerId);
	const canEditAway = canEditFull || canManageTeam(game?.awayTeam?.managerId);

	const handleSubmit = async () => {
		if (!id) return;

		setSaving(true);
		try {
			if (canEditFull && game?.status !== 'SCHEDULED') {
				await gameApi.update(id, periodScores);
			}

			const allStats = [
				...(canEditHome ? homeTeamStats : []),
				...(canEditAway ? awayTeamStats : []),
			];

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
			const statsMap = new Map<number, HockeyGameStatistic>();
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

	const renderPlayerRow = (stat: PlayerStatForm, team: 'home' | 'away', canEditTeam: boolean) => (
		<div key={stat.playerId} className="flex items-center gap-3 py-2 border-b last:border-b-0">
			<Checkbox
				id={`played-${stat.playerId}`}
				checked={stat.played}
				onCheckedChange={(checked) => updatePlayerStat(team, stat.playerId, 'played', !!checked)}
				disabled={!canEditTeam}
			/>
			<div className="flex-1 min-w-0">
				<Label htmlFor={`played-${stat.playerId}`} className={canEditTeam ? 'cursor-pointer' : 'cursor-default'}>
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
						disabled={!stat.played || !canEditTeam}
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
						disabled={!stat.played || !canEditTeam}
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

	if (!canEditHome && !canEditAway) {
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

								<div className="flex flex-col items-center gap-2 px-4">
									{canEditFull ? (
										<div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-2 gap-y-1 text-xs">
											<Label className="text-xs text-muted-foreground text-right whitespace-nowrap">{t('gameStatistic.total', 'Total')}</Label>
											<Input type="number" min={0} value={periodScores.homeScore ?? ''} onChange={e => setPeriodScores(s => ({ ...s, homeScore: e.target.value !== '' ? parseInt(e.target.value) : null }))} className="w-14 h-7 text-center text-sm px-1" />
											<span className="text-muted-foreground text-center">-</span>
											<Input type="number" min={0} value={periodScores.awayScore ?? ''} onChange={e => setPeriodScores(s => ({ ...s, awayScore: e.target.value !== '' ? parseInt(e.target.value) : null }))} className="w-14 h-7 text-center text-sm px-1" />

											<Label className="text-xs text-muted-foreground text-right whitespace-nowrap">{t('gameStatistic.period1', 'P1')}</Label>
											<Input type="number" min={0} value={periodScores.period1HomeScore ?? ''} onChange={e => setPeriodScores(s => ({ ...s, period1HomeScore: e.target.value !== '' ? parseInt(e.target.value) : null }))} className="w-14 h-7 text-center text-sm px-1" />
											<span className="text-muted-foreground text-center">-</span>
											<Input type="number" min={0} value={periodScores.period1AwayScore ?? ''} onChange={e => setPeriodScores(s => ({ ...s, period1AwayScore: e.target.value !== '' ? parseInt(e.target.value) : null }))} className="w-14 h-7 text-center text-sm px-1" />

											<Label className="text-xs text-muted-foreground text-right whitespace-nowrap">{t('gameStatistic.period2', 'P2')}</Label>
											<Input type="number" min={0} value={periodScores.period2HomeScore ?? ''} onChange={e => setPeriodScores(s => ({ ...s, period2HomeScore: e.target.value !== '' ? parseInt(e.target.value) : null }))} className="w-14 h-7 text-center text-sm px-1" />
											<span className="text-muted-foreground text-center">-</span>
											<Input type="number" min={0} value={periodScores.period2AwayScore ?? ''} onChange={e => setPeriodScores(s => ({ ...s, period2AwayScore: e.target.value !== '' ? parseInt(e.target.value) : null }))} className="w-14 h-7 text-center text-sm px-1" />

											<Label className="text-xs text-muted-foreground text-right whitespace-nowrap">{t('gameStatistic.period3', 'P3')}</Label>
											<Input type="number" min={0} value={periodScores.period3HomeScore ?? ''} onChange={e => setPeriodScores(s => ({ ...s, period3HomeScore: e.target.value !== '' ? parseInt(e.target.value) : null }))} className="w-14 h-7 text-center text-sm px-1" />
											<span className="text-muted-foreground text-center">-</span>
											<Input type="number" min={0} value={periodScores.period3AwayScore ?? ''} onChange={e => setPeriodScores(s => ({ ...s, period3AwayScore: e.target.value !== '' ? parseInt(e.target.value) : null }))} className="w-14 h-7 text-center text-sm px-1" />
										</div>
									) : (
										<div className="flex flex-col items-center gap-1">
											<div className="flex items-center gap-3">
												<span className="text-sm sm:text-3xl font-medium">{periodScores.homeScore ?? '-'}</span>
												<span className="text-sm sm:text-xl text-muted-foreground">-</span>
												<span className="text-sm sm:text-3xl font-medium">{periodScores.awayScore ?? '-'}</span>
											</div>
											{(periodScores.period1HomeScore != null || periodScores.period2HomeScore != null || periodScores.period3HomeScore != null) && (
												<div className="flex gap-3 text-xs text-muted-foreground">
													{([
														['P1', periodScores.period1HomeScore, periodScores.period1AwayScore],
														['P2', periodScores.period2HomeScore, periodScores.period2AwayScore],
														['P3', periodScores.period3HomeScore, periodScores.period3AwayScore],
													] as [string, number | null, number | null][]).map(([p, h, a]) => (
														<span key={p}>{p}: {h ?? '-'} - {a ?? '-'}</span>
													))}
												</div>
											)}
										</div>
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
										{homeTeamStats.map(stat => renderPlayerRow(stat, 'home', canEditHome))}
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
										{awayTeamStats.map(stat => renderPlayerRow(stat, 'away', canEditAway))}
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
