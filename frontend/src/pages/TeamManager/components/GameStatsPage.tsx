import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Loader2, Minus, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { gameApi, playerApi, gameStatisticApi, teamApi } from '@/services/api';

import { Button } from '@components/base/button';
import { GameStatus, type Game, type HockeyGameStatistic, type Player } from '@types';

interface PlayerStatForm {
	playerId: string;
	playerName: string;
	playerNumber: number | null;
	played: boolean;
	goals: number;
	assists: number;
	penaltyMinutes: number;
	existingStatId?: string;
}

/** Snapshot used to work out which rows actually need a request on save. */
const signature = (s: PlayerStatForm) => `${s.played}|${s.goals}|${s.assists}|${s.penaltyMinutes}`;

export default function GameStatsPage() {
	const { id: teamId, gameId } = useParams<{ id: string; gameId: string }>();
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [game, setGame] = useState<Game | null>(null);
	const [teamColor, setTeamColor] = useState<string | null>(null);
	const [teamStats, setTeamStats] = useState<PlayerStatForm[]>([]);
	const [baseline, setBaseline] = useState<Record<string, string>>({});
	const [isHomeTeam, setIsHomeTeam] = useState(false);

	const color = teamColor || '#003E7E';

	useEffect(() => {
		if (!gameId || !teamId) return;

		const fetchData = async () => {
			setLoading(true);
			try {
				const [gameResp, existingStatsResp, teamResp] = await Promise.all([
					gameApi.getById(gameId),
					gameStatisticApi.getByGame(gameId),
					teamApi.getById(teamId),
				]);

				const gameData = gameResp.data;

				// Verify this team is part of the game
				if (gameData.homeTeamId !== teamId && gameData.awayTeamId !== teamId) {
					toast.error(t('teamManagement.gameStats.notYourGame'));
					navigate(`/team-management/${teamId}`);
					return;
				}

				setGame(gameData);
				setIsHomeTeam(gameData.homeTeamId === teamId);
				setTeamColor(teamResp.data.primaryColor ?? null);

				const statsMap = new Map<string, HockeyGameStatistic>();
				existingStatsResp.data.forEach((stat) => statsMap.set(stat.playerId, stat));

				const playersResp = await playerApi.getByTeam(teamId);
				const stats: PlayerStatForm[] = playersResp.data.map((player: Player) => {
					const existingStat = statsMap.get(player.id);
					return {
						playerId: player.id,
						playerName: player.name,
						playerNumber: player.number ?? null,
						played: !!existingStat,
						goals: existingStat?.goals ?? 0,
						assists: existingStat?.assists ?? 0,
						penaltyMinutes: existingStat?.penaltyMinutes ?? 0,
						existingStatId: existingStat?.id,
					};
				});

				setTeamStats(stats);
				setBaseline(Object.fromEntries(stats.map((s) => [s.playerId, signature(s)])));
			} catch (error) {
				toast.error(t('teamManagement.gameStats.fetchError'));
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [gameId, teamId, t, navigate]);

	const dirty = useMemo(
		() => teamStats.filter((s) => baseline[s.playerId] !== signature(s)),
		[teamStats, baseline],
	);

	const totals = useMemo(() => {
		const active = teamStats.filter((s) => s.played);
		return {
			lineup: active.length,
			goals: active.reduce((sum, s) => sum + s.goals, 0),
			assists: active.reduce((sum, s) => sum + s.assists, 0),
			penaltyMinutes: active.reduce((sum, s) => sum + s.penaltyMinutes, 0),
		};
	}, [teamStats]);

	const patch = (playerId: string, changes: Partial<PlayerStatForm>) => {
		setTeamStats((prev) => prev.map((stat) => {
			if (stat.playerId !== playerId) return stat;
			const next = { ...stat, ...changes };
			// Unticking a player clears their numbers so the row reads honestly.
			if (changes.played === false) return { ...next, goals: 0, assists: 0, penaltyMinutes: 0 };
			return next;
		}));
	};

	type CounterField = 'goals' | 'assists' | 'penaltyMinutes';

	const step = (stat: PlayerStatForm, field: CounterField, delta: number) => {
		// Penalty minutes come in twos on the ice; the rest step by one.
		const value = Math.max(0, stat[field] + delta * (field === 'penaltyMinutes' ? 2 : 1));
		patch(stat.playerId, { [field]: value, played: true } as Partial<PlayerStatForm>);
	};

	const handleSubmit = async () => {
		if (!gameId || !dirty.length) return;

		setSaving(true);
		try {
			for (const stat of dirty) {
				if (stat.played) {
					if (stat.existingStatId) {
						await gameStatisticApi.update(stat.existingStatId, {
							goals: stat.goals,
							assists: stat.assists,
							penaltyMinutes: stat.penaltyMinutes,
						});
					} else {
						await gameStatisticApi.create(gameId, {
							playerId: stat.playerId,
							goals: stat.goals,
							assists: stat.assists,
							penaltyMinutes: stat.penaltyMinutes,
						});
					}
				} else if (stat.existingStatId) {
					await gameStatisticApi.delete(stat.existingStatId);
				}
			}

			toast.success(t('teamManagement.gameStats.saveSuccess'));

			const existingStatsResp = await gameStatisticApi.getByGame(gameId);
			const statsMap = new Map<string, HockeyGameStatistic>();
			existingStatsResp.data.forEach((stat) => statsMap.set(stat.playerId, stat));

			setTeamStats((prev) => {
				const next = prev.map((stat) => ({
					...stat,
					existingStatId: statsMap.get(stat.playerId)?.id,
				}));
				setBaseline(Object.fromEntries(next.map((s) => [s.playerId, signature(s)])));
				return next;
			});
		} catch (error) {
			toast.error(t('teamManagement.gameStats.saveError'));
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="size-8 animate-spin" />
			</div>
		);
	}

	if (!game) {
		return (
			<div className="py-12 text-center text-muted-foreground">
				{t('teamManagement.gameStats.notFound')}
			</div>
		);
	}

	const myTeam = isHomeTeam ? game.homeTeam : game.awayTeam;
	const opponentTeam = isHomeTeam ? game.awayTeam : game.homeTeam;
	const myScore = isHomeTeam ? game.homeScore : game.awayScore;
	const opponentScore = isHomeTeam ? game.awayScore : game.homeScore;
	const hasScore = game.status === GameStatus.COMPLETED && myScore != null && opponentScore != null;

	const periods = [
		[isHomeTeam ? game.period1HomeScore : game.period1AwayScore, isHomeTeam ? game.period1AwayScore : game.period1HomeScore],
		[isHomeTeam ? game.period2HomeScore : game.period2AwayScore, isHomeTeam ? game.period2AwayScore : game.period2HomeScore],
		[isHomeTeam ? game.period3HomeScore : game.period3AwayScore, isHomeTeam ? game.period3AwayScore : game.period3HomeScore],
	].filter(([mine]) => mine != null);

	const Stepper = ({ stat, field }: { stat: PlayerStatForm; field: CounterField }) => {
		const label = t(`teamManagement.gameStats.${field}`);
		return (
			<div className="tm-stat-stepper">
				<span className="tm-stat-label">{label}</span>
				<div className="tm-stat-controls">
					<button
						type="button"
						aria-label={`${label} −`}
						disabled={stat[field] === 0}
						onClick={() => step(stat, field, -1)}
					>
						<Minus className="size-3.5" />
					</button>
					<output className={stat.played ? undefined : 'text-muted-foreground'}>
						{stat[field]}
					</output>
					<button
						type="button"
						aria-label={`${label} +`}
						onClick={() => step(stat, field, 1)}
					>
						<Plus className="size-3.5" />
					</button>
				</div>
			</div>
		);
	};

	return (
		<div className="flex min-h-screen flex-col">
			{/* Game header */}
			<div
				className="tm-team-header flex flex-col gap-3 px-4 pb-3 pt-3 text-white"
				style={{ backgroundColor: color }}
			>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						className="-ml-2 size-11 text-white hover:bg-white/20"
						aria-label={t('common.back')}
						onClick={() => navigate(`/team-management/${teamId}`)}
					>
						<ArrowLeft className="size-5" />
					</Button>
					<div className="min-w-0 flex-1">
						<div className="truncate text-base font-semibold">
							{myTeam?.name} — {opponentTeam?.name}
						</div>
						<div className="truncate text-xs text-white/85">
							{game.date && new Date(game.date).toLocaleDateString(i18n.language, {
								day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
							})}
							{game.location && ` · ${game.location}`}
						</div>
					</div>
				</div>

				{hasScore && (
					<div className="flex items-center gap-3">
						<span className="text-2xl font-bold tabular-nums leading-none">
							{myScore}:{opponentScore}
						</span>
						{periods.length > 0 && (
							<span className="text-xs text-white/85">
								{periods.map(([mine, theirs], i) => `P${i + 1} ${mine}:${theirs}`).join('  ')}
							</span>
						)}
					</div>
				)}
			</div>

			{/* Running totals, then the column headers the steppers sit under */}
			<div className="flex items-center gap-4 border-b border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
				<span>
					{t('teamManagement.gameStats.lineup')}{' '}
					<b className="font-semibold text-foreground">{totals.lineup}</b>
				</span>
				<span>
					{t('teamManagement.gameStats.goals')}{' '}
					<b className="font-semibold text-foreground">{totals.goals}</b>
				</span>
				<span>
					{t('teamManagement.gameStats.assists')}{' '}
					<b className="font-semibold text-foreground">{totals.assists}</b>
				</span>
				<span>
					{t('teamManagement.gameStats.penaltyMinutesShort')}{' '}
					<b className="font-semibold text-foreground">{totals.penaltyMinutes}</b>
				</span>
			</div>

			{/* Rows */}
			<div className="flex-1 bg-card">
				{teamStats.length === 0 ? (
					<p className="px-4 py-8 text-center text-sm text-muted-foreground">
						{t('teamManagement.gameStats.noPlayers')}
					</p>
				) : (
					teamStats.map((stat) => (
						<div key={stat.playerId} className="tm-stat-row">
							<div className="tm-stat-identity">
								<button
									type="button"
									className="tm-stat-toggle"
									role="checkbox"
									aria-checked={stat.played}
									aria-label={stat.playerName}
									onClick={() => patch(stat.playerId, { played: !stat.played })}
								>
									<span
										className="tm-stat-box"
										style={stat.played ? { backgroundColor: color, borderColor: color } : undefined}
									>
										{stat.played && <Check className="size-3.5 text-white" strokeWidth={3} />}
									</span>
								</button>
								<span className="min-w-0 flex-1">
									<span className={`block truncate text-sm font-semibold leading-tight ${stat.played ? '' : 'text-muted-foreground'}`}>
										{stat.playerName}
									</span>
									{stat.playerNumber != null && (
										<span className="block text-[11.5px] text-muted-foreground">
											#{stat.playerNumber}
										</span>
									)}
								</span>
							</div>
							<div className="tm-stat-counters">
								<Stepper stat={stat} field="goals" />
								<Stepper stat={stat} field="assists" />
								<Stepper stat={stat} field="penaltyMinutes" />
							</div>
						</div>
					))
				)}
			</div>

			{/* Save bar */}
			<div className="tm-save-bar">
				<div className="min-w-0 flex-1 text-xs">
					{dirty.length > 0 ? (
						<span className="font-semibold">
							{t('teamManagement.gameStats.unsavedChanges', { count: dirty.length })}
						</span>
					) : (
						<span className="text-muted-foreground">
							{t('teamManagement.gameStats.allSaved')}
						</span>
					)}
				</div>
				<Button
					className="h-11 px-6 text-[15px] font-semibold text-white"
					style={{ backgroundColor: color }}
					disabled={saving || dirty.length === 0}
					onClick={handleSubmit}
				>
					{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
					{t('common.save')}
				</Button>
			</div>
		</div>
	);
}
