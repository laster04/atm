import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Loader2, Lock, Minus, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext.tsx';
import { gameApi, playerApi, gameStatisticApi } from '@/services/api';

import { Button } from "@components/base/button.tsx";
import { GameStatus, Game, Player, HockeyGameStatistic } from "@types";
import { ADMIN_GOLD, ADMIN_INK } from '../util';

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
	playerId: string;
	playerName: string;
	playerNumber: number | null;
	played: boolean;
	goals: number;
	assists: number;
	penaltyMinutes: number;
	existingStatId?: string;
}

type CounterField = 'goals' | 'assists' | 'penaltyMinutes';

const EMPTY_SCORES: PeriodScores = {
	homeScore: null,
	awayScore: null,
	period1HomeScore: null,
	period1AwayScore: null,
	period2HomeScore: null,
	period2AwayScore: null,
	period3HomeScore: null,
	period3AwayScore: null,
};

/** Snapshot used to work out which rows actually need a request on save. */
const signature = (s: PlayerStatForm) => `${s.played}|${s.goals}|${s.assists}|${s.penaltyMinutes}`;

/** The four editable score lines, as [label key, home field, away field]. */
const SCORE_LINES: [string, keyof PeriodScores, keyof PeriodScores][] = [
	['gameStatistic.total', 'homeScore', 'awayScore'],
	['gameStatistic.period1', 'period1HomeScore', 'period1AwayScore'],
	['gameStatistic.period2', 'period2HomeScore', 'period2AwayScore'],
	['gameStatistic.period3', 'period3HomeScore', 'period3AwayScore'],
];

function Stepper({
	label,
	value,
	dimmed,
	disabled,
	onStep,
}: {
	label: string;
	value: number;
	dimmed: boolean;
	disabled: boolean;
	onStep: (delta: number) => void;
}) {
	return (
		<div className="tm-stat-stepper">
			<span className="tm-stat-label">{label}</span>
			<div className="tm-stat-controls">
				<button
					type="button"
					aria-label={`${label} −`}
					disabled={disabled || value === 0}
					onClick={() => onStep(-1)}
				>
					<Minus className="size-3.5" />
				</button>
				<output className={dimmed ? 'text-muted-foreground' : undefined}>{value}</output>
				<button
					type="button"
					aria-label={`${label} +`}
					disabled={disabled}
					onClick={() => onStep(1)}
				>
					<Plus className="size-3.5" />
				</button>
			</div>
		</div>
	);
}

export default function HockeyGameStatisticPage(): React.JSX.Element {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();
	const { isAdmin, isSeasonManager, canManageTeam } = useAuth();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [game, setGame] = useState<Game | null>(null);
	const [periodScores, setPeriodScores] = useState<PeriodScores>(EMPTY_SCORES);
	const [scoreBaseline, setScoreBaseline] = useState<PeriodScores>(EMPTY_SCORES);
	const [homeTeamStats, setHomeTeamStats] = useState<PlayerStatForm[]>([]);
	const [awayTeamStats, setAwayTeamStats] = useState<PlayerStatForm[]>([]);
	const [baseline, setBaseline] = useState<Record<string, string>>({});

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
				const scores: PeriodScores = {
					homeScore: gameData.homeScore ?? null,
					awayScore: gameData.awayScore ?? null,
					period1HomeScore: gameData.period1HomeScore ?? null,
					period1AwayScore: gameData.period1AwayScore ?? null,
					period2HomeScore: gameData.period2HomeScore ?? null,
					period2AwayScore: gameData.period2AwayScore ?? null,
					period3HomeScore: gameData.period3HomeScore ?? null,
					period3AwayScore: gameData.period3AwayScore ?? null,
				};
				setPeriodScores(scores);
				setScoreBaseline(scores);

				const existingStats = existingStatsResp.data;
				const statsMap = new Map<string, HockeyGameStatistic>();
				existingStats.forEach(stat => statsMap.set(stat.playerId, stat));

				// Fetch players for both teams
				const [homePlayersResp, awayPlayersResp] = await Promise.all([
					playerApi.getByTeam(gameData.homeTeamId),
					playerApi.getByTeam(gameData.awayTeamId)
				]);

				const toForm = (player: Player): PlayerStatForm => {
					const existingStat = statsMap.get(player.id);
					return {
						playerId: player.id,
						playerName: player.name,
						playerNumber: player.number ?? null,
						played: !!existingStat,
						goals: existingStat?.goals ?? 0,
						assists: existingStat?.assists ?? 0,
						penaltyMinutes: existingStat?.penaltyMinutes ?? 0,
						existingStatId: existingStat?.id
					};
				};

				const homeStats = homePlayersResp.data.map(toForm);
				const awayStats = awayPlayersResp.data.map(toForm);

				setHomeTeamStats(homeStats);
				setAwayTeamStats(awayStats);
				setBaseline(Object.fromEntries([...homeStats, ...awayStats].map(s => [s.playerId, signature(s)])));
			} catch (error) {
				toast.error(t('gameStatistic.fetchError'));
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [id, t]);

	const patch = (team: 'home' | 'away', playerId: string, changes: Partial<PlayerStatForm>) => {
		const setter = team === 'home' ? setHomeTeamStats : setAwayTeamStats;
		setter(prev => prev.map(stat => {
			if (stat.playerId !== playerId) return stat;
			const next = { ...stat, ...changes };
			// Unticking a player clears their numbers so the row reads honestly.
			if (changes.played === false) return { ...next, goals: 0, assists: 0, penaltyMinutes: 0 };
			return next;
		}));
	};

	const step = (team: 'home' | 'away', stat: PlayerStatForm, field: CounterField, delta: number) => {
		// Penalty minutes come in twos on the ice; the rest step by one.
		const value = Math.max(0, stat[field] + delta * (field === 'penaltyMinutes' ? 2 : 1));
		patch(team, stat.playerId, { [field]: value, played: true } as Partial<PlayerStatForm>);
	};

	const canEditFull = isAdmin() || isSeasonManager();
	const canEditHome = canEditFull || canManageTeam(game?.homeTeam?.managerId);
	const canEditAway = canEditFull || canManageTeam(game?.awayTeam?.managerId);

	const dirtyStats = useMemo(() => {
		const rows = [
			...(canEditHome ? homeTeamStats : []),
			...(canEditAway ? awayTeamStats : []),
		];
		return rows.filter(s => baseline[s.playerId] !== signature(s));
	}, [homeTeamStats, awayTeamStats, baseline, canEditHome, canEditAway]);

	const scoreDirty = useMemo(
		() => canEditFull && SCORE_LINES.some(([, h, a]) =>
			periodScores[h] !== scoreBaseline[h] || periodScores[a] !== scoreBaseline[a]),
		[canEditFull, periodScores, scoreBaseline],
	);

	const dirtyCount = dirtyStats.length + (scoreDirty ? 1 : 0);

	const setScore = (field: keyof PeriodScores, raw: string) => {
		const parsed = raw === '' ? null : Math.max(0, parseInt(raw));
		setPeriodScores(prev => ({ ...prev, [field]: Number.isNaN(parsed as number) ? null : parsed }));
	};

	const handleSubmit = async () => {
		if (!id || !dirtyCount) return;

		setSaving(true);
		try {
			if (scoreDirty) {
				// A game still marked SCHEDULED but carrying a score has been played;
				// the season manager's result sheet flips it the same way.
				const played = game?.status === GameStatus.SCHEDULED && periodScores.homeScore != null && periodScores.awayScore != null;
				const updated = await gameApi.update(id, played ? { ...periodScores, status: GameStatus.COMPLETED } : periodScores);
				// Only the status is taken back: the rest of the loaded game (colours,
				// managers, season) is richer than what the update endpoint returns.
				setGame(prev => (prev ? { ...prev, status: updated.data.status } : prev));
				setScoreBaseline(periodScores);
			}

			for (const stat of dirtyStats) {
				if (stat.played) {
					// Player participated - create or update
					if (stat.existingStatId) {
						await gameStatisticApi.update(stat.existingStatId, {
							goals: stat.goals,
							assists: stat.assists,
							penaltyMinutes: stat.penaltyMinutes
						});
					} else {
						await gameStatisticApi.create(id, {
							playerId: stat.playerId,
							goals: stat.goals,
							assists: stat.assists,
							penaltyMinutes: stat.penaltyMinutes
						});
					}
				} else if (stat.existingStatId) {
					// Player didn't participate but has existing stat - delete it
					await gameStatisticApi.delete(stat.existingStatId);
				}
			}

			toast.success(t('gameStatistic.saveSuccess'));

			// Refresh data to get updated IDs
			const existingStatsResp = await gameStatisticApi.getByGame(id);
			const statsMap = new Map<string, HockeyGameStatistic>();
			existingStatsResp.data.forEach(stat => statsMap.set(stat.playerId, stat));

			const relabel = (prev: PlayerStatForm[]) => prev.map(stat => ({
				...stat,
				existingStatId: statsMap.get(stat.playerId)?.id
			}));

			setHomeTeamStats(prev => {
				const next = relabel(prev);
				setBaseline(b => ({ ...b, ...Object.fromEntries(next.map(s => [s.playerId, signature(s)])) }));
				return next;
			});
			setAwayTeamStats(prev => {
				const next = relabel(prev);
				setBaseline(b => ({ ...b, ...Object.fromEntries(next.map(s => [s.playerId, signature(s)])) }));
				return next;
			});
		} catch (error) {
			toast.error(t('gameStatistic.saveError'));
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="size-8 animate-spin" />
			</div>
		);
	}

	if (!game) {
		return (
			<div className="py-12 text-center text-muted-foreground">
				{t('gameStatistic.notFound')}
			</div>
		);
	}

	if (!canEditHome && !canEditAway) {
		return (
			<div className="py-12 text-center text-muted-foreground">
				{t('gameStatistic.unauthorized')}
			</div>
		);
	}

	const subtitle = [
		typeof game.round === 'number' ? t('seasonManagement.games.round', { n: game.round }) : null,
		game.date
			? new Date(game.date).toLocaleDateString(i18n.language, {
				day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
			})
			: null,
		game.location || null,
	].filter(Boolean).join(' · ');

	const teamPanel = (side: 'home' | 'away') => {
		const team = side === 'home' ? game.homeTeam : game.awayTeam;
		const stats = side === 'home' ? homeTeamStats : awayTeamStats;
		const canEditTeam = side === 'home' ? canEditHome : canEditAway;
		const color = team?.primaryColor ?? '#808080';
		const active = stats.filter(s => s.played);
		const totals = {
			lineup: active.length,
			goals: active.reduce((sum, s) => sum + s.goals, 0),
			assists: active.reduce((sum, s) => sum + s.assists, 0),
			penaltyMinutes: active.reduce((sum, s) => sum + s.penaltyMinutes, 0),
		};

		return (
			<section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
				<header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
					<span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
					<span className="min-w-0 flex-1">
						<span className="block truncate text-[15px] font-semibold leading-tight">{team?.name}</span>
						<span className="text-[11px] uppercase tracking-wide text-muted-foreground">
							{t(side === 'home' ? 'gameStatistic.home' : 'gameStatistic.away')}
						</span>
					</span>
					{!canEditTeam && (
						<span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
							<Lock className="size-3" aria-hidden />
							{t('gameStatistic.viewOnly')}
						</span>
					)}
				</header>

				<div className="flex items-center gap-4 border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
					<span>
						{t('gameStatistic.lineup')} <b className="font-semibold text-foreground">{totals.lineup}</b>
					</span>
					<span>
						{t('gameStatistic.goals')} <b className="font-semibold text-foreground">{totals.goals}</b>
					</span>
					<span>
						{t('gameStatistic.assists')} <b className="font-semibold text-foreground">{totals.assists}</b>
					</span>
					<span>
						{t('gameStatistic.penaltyMinutes')} <b className="font-semibold text-foreground">{totals.penaltyMinutes}</b>
					</span>
				</div>

				{stats.length === 0 ? (
					<p className="px-4 py-8 text-center text-sm text-muted-foreground">
						{t('gameStatistic.noPlayers')}
					</p>
				) : (
					<div className="flex flex-col">
						{stats.map(stat => (
							<div key={stat.playerId} className="tm-stat-row last:border-b-0">
								<div className="tm-stat-identity">
									<button
										type="button"
										className="tm-stat-toggle disabled:opacity-40"
										role="checkbox"
										aria-checked={stat.played}
										aria-label={stat.playerName}
										disabled={!canEditTeam}
										onClick={() => patch(side, stat.playerId, { played: !stat.played })}
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
									<Stepper
										label={t('gameStatistic.goals')}
										value={stat.goals}
										dimmed={!stat.played}
										disabled={!canEditTeam}
										onStep={(delta) => step(side, stat, 'goals', delta)}
									/>
									<Stepper
										label={t('gameStatistic.assists')}
										value={stat.assists}
										dimmed={!stat.played}
										disabled={!canEditTeam}
										onStep={(delta) => step(side, stat, 'assists', delta)}
									/>
									<Stepper
										label={t('gameStatistic.penaltyMinutes')}
										value={stat.penaltyMinutes}
										dimmed={!stat.played}
										disabled={!canEditTeam}
										onStep={(delta) => step(side, stat, 'penaltyMinutes', delta)}
									/>
								</div>
							</div>
						))}
					</div>
				)}
			</section>
		);
	};

	return (
		<div className="flex min-h-screen flex-col bg-background">
			{/* Gold header: this screen is reached from the admin tables, so it wears
				the admin shell's colour. Gold is too light for white ink. */}
			<div
				className="tm-team-header shrink-0 shadow-sm"
				style={{ backgroundColor: ADMIN_GOLD, color: ADMIN_INK }}
			>
				<div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3">
					<button
						type="button"
						onClick={() => navigate(-1)}
						aria-label={t('common.back')}
						className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-black/10"
					>
						<ArrowLeft className="size-5" aria-hidden />
					</button>
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-base font-bold leading-tight">
							{game.homeTeam?.name} — {game.awayTeam?.name}
						</h1>
						{subtitle && <p className="truncate text-xs opacity-75">{subtitle}</p>}
					</div>
					<span className="shrink-0 text-2xl font-bold tabular-nums">
						{periodScores.homeScore ?? '-'}:{periodScores.awayScore ?? '-'}
					</span>
				</div>
			</div>

			<div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
				{/* Score */}
				<section className="flex flex-col gap-2">
					<span className="tm-section-label">{t('gameStatistic.score')}</span>
					<div className="tm-rows-card">
						<div className="flex items-center gap-3 px-3.5 py-2">
							<span className="w-12 shrink-0" />
							<span className="flex-1" />
							<span className="flex shrink-0 items-center gap-2">
								{([['home', game.homeTeam], ['away', game.awayTeam]] as const).map(([side, team], index) => (
									<React.Fragment key={side}>
										{index === 1 && <span className="w-2" />}
										<span className="flex w-20 flex-col items-center gap-0.5">
											<span
												className="size-2.5 rounded-full"
												style={{ backgroundColor: team?.primaryColor ?? '#cbd5e1' }}
											/>
											<span className="w-full truncate text-center text-[11px] font-semibold" title={team?.name}>
												{team?.name}
											</span>
											<span className="text-[9.5px] uppercase tracking-wide text-muted-foreground">
												{t(side === 'home' ? 'gameStatistic.home' : 'gameStatistic.away')}
											</span>
										</span>
									</React.Fragment>
								))}
							</span>
						</div>
						{SCORE_LINES.map(([labelKey, homeField, awayField]) => (
							<div key={labelKey} className="flex min-h-[56px] items-center gap-3 px-3.5">
								<span className="w-12 shrink-0 text-[13px] font-semibold text-muted-foreground">
									{t(labelKey)}
								</span>
								<span className="flex-1" />
								{canEditFull ? (
									<span className="flex shrink-0 items-center gap-2">
										<input
											type="number"
											min={0}
											inputMode="numeric"
											aria-label={`${t(labelKey)} ${t('gameStatistic.home')}`}
											value={periodScores[homeField] ?? ''}
											onChange={(e) => setScore(homeField, e.target.value)}
											className="sm-score-input h-11 w-20 rounded-[10px] bg-input-background text-center text-base font-semibold tabular-nums"
										/>
										<span className="w-2 text-center text-sm text-muted-foreground">:</span>
										<input
											type="number"
											min={0}
											inputMode="numeric"
											aria-label={`${t(labelKey)} ${t('gameStatistic.away')}`}
											value={periodScores[awayField] ?? ''}
											onChange={(e) => setScore(awayField, e.target.value)}
											className="sm-score-input h-11 w-20 rounded-[10px] bg-input-background text-center text-base font-semibold tabular-nums"
										/>
									</span>
								) : (
									<span className="flex shrink-0 items-center gap-2 text-base font-semibold tabular-nums">
										<span className="w-20 text-center">{periodScores[homeField] ?? '-'}</span>
										<span className="w-2 text-center text-sm text-muted-foreground">:</span>
										<span className="w-20 text-center">{periodScores[awayField] ?? '-'}</span>
									</span>
								)}
							</div>
						))}
					</div>
				</section>

				{/* Line-ups */}
				<div className="grid gap-4 lg:grid-cols-2">
					{teamPanel('home')}
					{teamPanel('away')}
				</div>
			</div>

			<div className="tm-save-bar">
				<div className="mx-auto flex w-full max-w-5xl items-center gap-3">
					<div className="min-w-0 flex-1 text-xs">
						{dirtyCount > 0 ? (
							<span className="font-semibold">
								{t('gameStatistic.unsavedChanges', { count: dirtyCount })}
							</span>
						) : (
							<span className="text-muted-foreground">{t('gameStatistic.allSaved')}</span>
						)}
					</div>
					<Button
						className="h-11 px-6 text-[15px] font-semibold"
						style={{ backgroundColor: ADMIN_GOLD, color: ADMIN_INK }}
						disabled={saving || dirtyCount === 0}
						onClick={handleSubmit}
					>
						{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
						{t('common.save')}
					</Button>
				</div>
			</div>
		</div>
	);
}
