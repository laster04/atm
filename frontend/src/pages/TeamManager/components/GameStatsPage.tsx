import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGoBack } from '@/hooks';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft, Check, Loader2, Minus, Plus, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { gameApi, playerApi, gameStatisticApi, teamApi } from '@/services/api';

import { Button } from '@components/base/button';
import { GameStatus, type Game, type PlayerGameStatistic, type Player, type ResultClaimsView, type StatKey } from '@types';
import { APP_TIME_ZONE } from '@/utils/date';
import { formatParts, profileFor } from '@/utils/sportProfiles';

interface PlayerStatForm {
	playerId: string;
	playerName: string;
	playerNumber: number | null;
	played: boolean;
	/** Only the numbers the sport keeps. */
	values: Partial<Record<StatKey, number>>;
	existingStatId?: string;
}

/** Snapshot used to work out which rows actually need a request on save. */
const signature = (s: PlayerStatForm) => `${s.played}|${JSON.stringify(s.values)}`;

/** Penalty minutes come in twos on the ice; everything else steps by one. */
const STEP: Partial<Record<StatKey, number>> = { penaltyMinutes: 2 };
/**
 * Fields that can also be typed: basketball points, as tapping to 24 one at a
 * time is no way to keep score, and penalty minutes, as a 5 or 10 minute
 * penalty is out of reach in steps of two.
 */
const TYPED: StatKey[] = ['points', 'penaltyMinutes'];

export default function GameStatsPage() {
	const { id: teamId, gameId } = useParams<{ id: string; gameId: string }>();
	// Back to the team screen that opened this one, not a fresh copy of it.
	const goBackToTeam = useGoBack(`/team-management/${teamId}`);
	const { t, i18n } = useTranslation();

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [game, setGame] = useState<Game | null>(null);
	const [teamColor, setTeamColor] = useState<string | null>(null);
	const [teamStats, setTeamStats] = useState<PlayerStatForm[]>([]);
	const [baseline, setBaseline] = useState<Record<string, string>>({});
	const [isHomeTeam, setIsHomeTeam] = useState(false);
	// The final score as this team reports it, from its own side: ours first.
	const [claims, setClaims] = useState<ResultClaimsView | null>(null);
	const [ourScore, setOurScore] = useState(0);
	const [theirScore, setTheirScore] = useState(0);
	const [sending, setSending] = useState(false);

	const color = teamColor || '#003E7E';
	const profile = profileFor(game?.season?.league?.sportType);
	const fields = profile.stats;

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
					goBackToTeam();
					return;
				}

				setGame(gameData);
				setIsHomeTeam(gameData.homeTeamId === teamId);
				setTeamColor(teamResp.data.primaryColor ?? null);

				const statsMap = new Map<string, PlayerGameStatistic>();
				existingStatsResp.data.forEach((stat) => statsMap.set(stat.playerId, stat));

				const keys = profileFor(gameData.season?.league?.sportType).stats;
				const playersResp = await playerApi.getByTeam(teamId);
				const stats: PlayerStatForm[] = playersResp.data.map((player: Player) => {
					const existingStat = statsMap.get(player.id);
					return {
						playerId: player.id,
						playerName: player.name,
						playerNumber: player.number ?? null,
						played: !!existingStat,
						values: Object.fromEntries(keys.map((key) => [key, existingStat?.[key] ?? 0])),
						existingStatId: existingStat?.id,
					};
				});

				setTeamStats(stats);
				setBaseline(Object.fromEntries(stats.map((s) => [s.playerId, signature(s)])));

				// Only a team's own manager reports its result; anyone else just
				// sees the statistics, as before.
				const claimsResp = await gameApi.getResultClaims(gameId).catch(() => null);
				if (claimsResp && claimsResp.data.teamIds.includes(teamId)) {
					setClaims(claimsResp.data);
					const home = gameData.homeTeamId === teamId;
					const own = claimsResp.data.claims.find((c) => c.teamId === teamId);
					const startHome = own?.homeScore ?? gameData.homeScore ?? 0;
					const startAway = own?.awayScore ?? gameData.awayScore ?? 0;
					setOurScore(home ? startHome : startAway);
					setTheirScore(home ? startAway : startHome);
				}
			} catch (error) {
				toast.error(t('teamManagement.gameStats.fetchError'));
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [gameId, teamId, t, goBackToTeam]);

	const dirty = useMemo(
		() => teamStats.filter((s) => baseline[s.playerId] !== signature(s)),
		[teamStats, baseline],
	);

	const totals = useMemo(() => {
		const active = teamStats.filter((s) => s.played);
		return {
			lineup: active.length,
			byField: fields.map((key) => ({ key, sum: active.reduce((sum, s) => sum + (s.values[key] ?? 0), 0) })),
		};
	}, [teamStats, fields]);

	const patch = (playerId: string, changes: Partial<PlayerStatForm>) => {
		setTeamStats((prev) => prev.map((stat) => {
			if (stat.playerId !== playerId) return stat;
			const next = { ...stat, ...changes };
			// Unticking a player clears their numbers so the row reads honestly.
			if (changes.played === false) return { ...next, values: Object.fromEntries(fields.map((key) => [key, 0])) };
			return next;
		}));
	};

	const setValue = (stat: PlayerStatForm, field: StatKey, value: number) =>
		patch(stat.playerId, { values: { ...stat.values, [field]: Math.max(0, value) }, played: true });

	const step = (stat: PlayerStatForm, field: StatKey, delta: number) =>
		setValue(stat, field, (stat.values[field] ?? 0) + delta * (STEP[field] ?? 1));

	/** Saves the changed rows; true when there was nothing to save or all of it saved. */
	const saveStats = async (): Promise<boolean> => {
		if (!gameId || !dirty.length) return true;

		setSaving(true);
		try {
			for (const stat of dirty) {
				if (stat.played) {
					if (stat.existingStatId) {
						await gameStatisticApi.update(stat.existingStatId, stat.values);
					} else {
						await gameStatisticApi.create(gameId, { playerId: stat.playerId, ...stat.values });
					}
				} else if (stat.existingStatId) {
					await gameStatisticApi.delete(stat.existingStatId);
				}
			}

			toast.success(t('teamManagement.gameStats.saveSuccess'));

			const existingStatsResp = await gameStatisticApi.getByGame(gameId);
			const statsMap = new Map<string, PlayerGameStatistic>();
			existingStatsResp.data.forEach((stat) => statsMap.set(stat.playerId, stat));

			setTeamStats((prev) => {
				const next = prev.map((stat) => ({
					...stat,
					existingStatId: statsMap.get(stat.playerId)?.id,
				}));
				setBaseline(Object.fromEntries(next.map((s) => [s.playerId, signature(s)])));
				return next;
			});
			return true;
		} catch (error) {
			toast.error(t('teamManagement.gameStats.saveError'));
			return false;
		} finally {
			setSaving(false);
		}
	};

	const handleSubmit = () => { void saveStats(); };

	// The players' statistics go in first: once both scores match, the game is
	// confirmed and its statistics close with it.
	const sendScore = async () => {
		if (!gameId || !teamId || !game) return;
		if (!(await saveStats())) return;

		setSending(true);
		try {
			const score = isHomeTeam
				? { homeScore: ourScore, awayScore: theirScore }
				: { homeScore: theirScore, awayScore: ourScore };
			const res = await gameApi.submitResultClaim(gameId, teamId, score);
			setClaims(res.data);
			if (res.data.outcome === 'CONFIRMED') {
				const fresh = await gameApi.getById(gameId);
				setGame(fresh.data);
				toast.success(t('resultClaim.state.CONFIRMED'));
			} else {
				toast.success(t('resultClaim.sent'));
			}
		} catch (error) {
			toast.error(t('resultClaim.sendError'));
		} finally {
			setSending(false);
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

	// Parts read from this team's side: its own score first.
	const parts = formatParts(
		game.periodScores?.map((part) => (isHomeTeam ? part : { home: part.away, away: part.home })),
		profile,
	);

	// This team's report on the final score, read from its own side.
	const ownClaim = claims?.claims.find((c) => c.teamId === teamId);
	const theirClaim = claims?.claims.find((c) => c.teamId !== teamId);
	const theirReport = theirClaim && theirClaim.homeScore != null && theirClaim.awayScore != null
		? (isHomeTeam ? `${theirClaim.homeScore}:${theirClaim.awayScore}` : `${theirClaim.awayScore}:${theirClaim.homeScore}`)
		: null;
	const canSend = claims != null && claims.block === null;
	const claimStatus = (() => {
		if (!claims) return '';
		if (claims.block === 'CONFIRMED') {
			return claims.state === 'CONFIRMED' ? t('resultClaim.state.CONFIRMED') : t('resultClaim.block.CONFIRMED');
		}
		if (claims.block) return t(`resultClaim.block.${claims.block}`);
		if (!claims.state) return claims.autoConfirm ? t('resultClaim.hint') : t('resultClaim.hintManual');
		if (claims.state === 'WAITING') {
			return ownClaim
				? t('resultClaim.waitingThem', { team: opponentTeam?.name })
				: t('resultClaim.opponentSent', { team: opponentTeam?.name });
		}
		return t(`resultClaim.state.${claims.state}`);
	})();
	// Goals (points in basketball) of the players ticked above, against the score typed.
	const goalKey = fields.find((key) => key === 'goals' || key === 'points');
	const goalSum = goalKey ? totals.byField.find((f) => f.key === goalKey)?.sum ?? 0 : null;
	const goalsMismatch = canSend && goalSum !== null && totals.lineup > 0 && goalSum !== ourScore;

	const ScoreStepper = ({ name, value, onChange }: { name?: string; value: number; onChange: (next: number) => void }) => (
		<div className="flex items-center gap-2.5">
			<span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{name}</span>
			<span className="tm-stat-controls">
				<button
					type="button"
					aria-label={`${name} −`}
					disabled={!canSend || value === 0}
					onClick={() => onChange(Math.max(0, value - 1))}
				>
					<Minus className="size-3.5" />
				</button>
				<output className="w-8 text-center text-xl font-bold tabular-nums">{value}</output>
				<button
					type="button"
					aria-label={`${name} +`}
					disabled={!canSend}
					onClick={() => onChange(value + 1)}
				>
					<Plus className="size-3.5" />
				</button>
			</span>
		</div>
	);

	const Stepper = ({ stat, field }: { stat: PlayerStatForm; field: StatKey }) => {
		const label = t(`stats.short.${field}`);
		const value = stat.values[field] ?? 0;
		return (
			<div className="tm-stat-stepper">
				<span className="tm-stat-label">{label}</span>
				<div className="tm-stat-controls">
					<button
						type="button"
						aria-label={`${label} −`}
						disabled={value === 0}
						onClick={() => step(stat, field, -1)}
					>
						<Minus className="size-3.5" />
					</button>
					{TYPED.includes(field) ? (
						<input
							type="number"
							min={0}
							inputMode="numeric"
							aria-label={label}
							value={value}
							onChange={(e) => setValue(stat, field, Number(e.target.value) || 0)}
							className={`w-10 bg-transparent text-center tabular-nums ${stat.played ? '' : 'text-muted-foreground'}`}
						/>
					) : (
						<output className={stat.played ? undefined : 'text-muted-foreground'}>{value}</output>
					)}
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
						onClick={goBackToTeam}
					>
						<ArrowLeft className="size-5" />
					</Button>
					<div className="min-w-0 flex-1">
						<div className="truncate text-base font-semibold">
							{myTeam?.name} — {opponentTeam?.name}
						</div>
						<div className="truncate text-xs text-white/85">
							{game.date && new Date(game.date).toLocaleDateString(i18n.language, { timeZone: APP_TIME_ZONE, 
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
						{parts && <span className="text-xs text-white/85">{parts}</span>}
					</div>
				)}
			</div>

			{/* The final score this team reports; two matching reports confirm the game */}
			{claims && claims.block !== 'SPORT' && (
				<section
					aria-label={t('resultClaim.title')}
					className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3.5"
				>
					<span className="tm-section-label">{t('resultClaim.title')}</span>
					<ScoreStepper name={myTeam?.name} value={ourScore} onChange={setOurScore} />
					<ScoreStepper name={opponentTeam?.name} value={theirScore} onChange={setTheirScore} />
					<p className="text-[12.5px] leading-snug text-muted-foreground">{claimStatus}</p>
					{theirReport && claims.state !== 'CONFIRMED' && claims.state !== 'WAITING' && (
						<p className="text-[12.5px] font-semibold leading-snug">
							{t('resultClaim.theirScore', { team: opponentTeam?.name, score: theirReport })}
						</p>
					)}
					{goalsMismatch && (
						<p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-amber-800">
							<AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
							{t('resultClaim.goalsMismatch', { sum: goalSum, score: ourScore })}
						</p>
					)}
					{canSend && (
						<Button
							className="h-11 text-[15px] font-semibold text-white"
							style={{ backgroundColor: color }}
							disabled={sending || saving}
							onClick={sendScore}
						>
							{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
							{ownClaim ? t('resultClaim.resend') : t('resultClaim.send')}
						</Button>
					)}
				</section>
			)}

			{/* Running totals, then the column headers the steppers sit under */}
			<div className="flex items-center gap-4 border-b border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
				<span>
					{t('teamManagement.gameStats.lineup')}{' '}
					<b className="font-semibold text-foreground">{totals.lineup}</b>
				</span>
				{totals.byField.map(({ key, sum }) => (
					<span key={key}>
						{t(`stats.short.${key}`)}{' '}
						<b className="font-semibold text-foreground">{sum}</b>
					</span>
				))}
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
							{fields.length > 0 && (
								<div className="tm-stat-counters">
									{fields.map((field) => <Stepper key={field} stat={stat} field={field} />)}
								</div>
							)}
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
