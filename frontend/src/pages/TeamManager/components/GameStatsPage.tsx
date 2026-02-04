import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { gameApi, playerApi, gameStatisticApi } from '@/services/api';

import { Card, CardContent, CardHeader, CardTitle } from "@components/base/card.tsx";
import { Button } from "@components/base/button.tsx";
import { Input } from "@components/base/input.tsx";
import { Checkbox } from "@components/base/checkbox.tsx";
import { Label } from "@components/base/label.tsx";
import { Badge } from "@components/base/badge.tsx";
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

export default function GameStatsPage() {
	const { id: teamId, gameId } = useParams<{ id: string; gameId: string }>();
	const navigate = useNavigate();
	const { t } = useTranslation();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [game, setGame] = useState<Game | null>(null);
	const [teamStats, setTeamStats] = useState<PlayerStatForm[]>([]);
	const [isHomeTeam, setIsHomeTeam] = useState(false);

	useEffect(() => {
		if (!gameId || !teamId) return;

		const fetchData = async () => {
			setLoading(true);
			try {
				const [gameResp, existingStatsResp] = await Promise.all([
					gameApi.getById(gameId),
					gameStatisticApi.getByGame(gameId)
				]);

				const gameData = gameResp.data;
				setGame(gameData);

				const teamIdNum = parseInt(teamId);
				const isHome = gameData.homeTeamId === teamIdNum;
				setIsHomeTeam(isHome);

				// Verify this team is part of the game
				if (gameData.homeTeamId !== teamIdNum && gameData.awayTeamId !== teamIdNum) {
					toast.error(t('teamManagement.gameStats.notYourGame'));
					navigate(`/team-management/${teamId}`);
					return;
				}

				const existingStats = existingStatsResp.data;
				const statsMap = new Map<number, GameStatistic>();
				existingStats.forEach(stat => statsMap.set(stat.playerId, stat));

				// Fetch players only for the managed team
				const playersResp = await playerApi.getByTeam(teamIdNum);

				const stats: PlayerStatForm[] = playersResp.data.map((player: Player) => {
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

				setTeamStats(stats);
			} catch (error) {
				toast.error(t('teamManagement.gameStats.fetchError'));
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [gameId, teamId, t, navigate]);

	const updatePlayerStat = (
		playerId: number,
		field: keyof PlayerStatForm,
		value: boolean | number
	) => {
		setTeamStats(prev => prev.map(stat =>
			stat.playerId === playerId ? { ...stat, [field]: value } : stat
		));
	};

	const handleSubmit = async () => {
		if (!gameId) return;

		setSaving(true);
		try {
			for (const stat of teamStats) {
				if (stat.played) {
					if (stat.existingStatId) {
						await gameStatisticApi.update(stat.existingStatId, {
							goals: stat.goals,
							assists: stat.assists
						});
					} else {
						await gameStatisticApi.create(gameId, {
							playerId: stat.playerId,
							goals: stat.goals,
							assists: stat.assists
						});
					}
				} else if (stat.existingStatId) {
					await gameStatisticApi.delete(stat.existingStatId);
				}
			}

			toast.success(t('teamManagement.gameStats.saveSuccess'));

			// Refresh data to get updated IDs
			const existingStatsResp = await gameStatisticApi.getByGame(gameId);
			const statsMap = new Map<number, GameStatistic>();
			existingStatsResp.data.forEach(stat => statsMap.set(stat.playerId, stat));

			setTeamStats(prev => prev.map(stat => ({
				...stat,
				existingStatId: statsMap.get(stat.playerId)?.id
			})));
		} catch (error) {
			toast.error(t('teamManagement.gameStats.saveError'));
		} finally {
			setSaving(false);
		}
	};

	const renderPlayerRow = (stat: PlayerStatForm) => (
		<div key={stat.playerId} className="flex items-center gap-3 py-2 border-b last:border-b-0">
			<Checkbox
				id={`played-${stat.playerId}`}
				checked={stat.played}
				onCheckedChange={(checked) => updatePlayerStat(stat.playerId, 'played', !!checked)}
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
						{t('teamManagement.gameStats.goals')}
					</Label>
					<Input
						type="number"
						min={0}
						value={stat.goals}
						onChange={(e) => updatePlayerStat(stat.playerId, 'goals', parseInt(e.target.value) || 0)}
						disabled={!stat.played}
						className="w-16 text-center"
					/>
				</div>
				<div className="flex flex-col items-center">
					<Label className="text-xs text-muted-foreground mb-1">
						{t('teamManagement.gameStats.assists')}
					</Label>
					<Input
						type="number"
						min={0}
						value={stat.assists}
						onChange={(e) => updatePlayerStat(stat.playerId, 'assists', parseInt(e.target.value) || 0)}
						disabled={!stat.played}
						className="w-16 text-center"
					/>
				</div>
			</div>
		</div>
	);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	if (!game) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				{t('teamManagement.gameStats.notFound')}
			</div>
		);
	}

	const myTeam = isHomeTeam ? game.homeTeam : game.awayTeam;
	const opponentTeam = isHomeTeam ? game.awayTeam : game.homeTeam;
	const myScore = isHomeTeam ? game.homeScore : game.awayScore;
	const opponentScore = isHomeTeam ? game.awayScore : game.homeScore;

	return (
		<div className="space-y-4 p-4">
			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => navigate(`/team-management/${teamId}`)}
				>
					<ArrowLeft className="h-4 w-4 mr-1" />
					{t('common.back')}
				</Button>
			</div>

			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-lg flex items-center gap-2">
							<div
								className="size-4 rounded-full"
								style={{ backgroundColor: myTeam?.primaryColor ?? '#808080' }}
							/>
							{myTeam?.name}
							<span className="text-muted-foreground">vs</span>
							<div
								className="size-4 rounded-full"
								style={{ backgroundColor: opponentTeam?.primaryColor ?? '#808080' }}
							/>
							{opponentTeam?.name}
						</CardTitle>
						<Badge variant={isHomeTeam ? 'default' : 'outline'}>
							{isHomeTeam ? t('teamManagement.pwa.home') : t('teamManagement.pwa.away')}
						</Badge>
					</div>
					<div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
						{game.date && new Date(game.date).toLocaleDateString()}
						{game.location && ` • ${game.location}`}
					</div>
					{game.status === 'COMPLETED' && myScore != null && opponentScore != null && (
						<div className="flex items-center gap-2 mt-2">
							<span className="text-2xl font-bold">{myScore} : {opponentScore}</span>
							<Badge
								variant={myScore > opponentScore ? 'default' : myScore === opponentScore ? 'secondary' : 'destructive'}
								className={myScore > opponentScore ? 'bg-green-600' : ''}
							>
								{myScore > opponentScore ? t('teamManagement.pwa.win') : myScore === opponentScore ? t('teamManagement.pwa.draw') : t('teamManagement.pwa.loss')}
							</Badge>
						</div>
					)}
				</CardHeader>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-base flex items-center gap-2">
							<div
								className="size-4 rounded-full"
								style={{ backgroundColor: myTeam?.primaryColor ?? '#808080' }}
							/>
							{t('teamManagement.gameStats.playerStats')}
						</CardTitle>
						<Button onClick={handleSubmit} disabled={saving} size="sm">
							{saving ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : (
								<Save className="h-4 w-4 mr-2" />
							)}
							{t('common.save')}
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{teamStats.length === 0 ? (
						<p className="text-muted-foreground text-center py-4">
							{t('teamManagement.gameStats.noPlayers')}
						</p>
					) : (
						<div className="space-y-1">
							{teamStats.map(stat => renderPlayerRow(stat))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
