import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flag, Lock, SearchX } from 'lucide-react';
import { AxiosError } from 'axios';
import { scorerApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { GameStatus, type CourtGame, type CourtGoalInput, type CourtScorerPage } from '@types';
import { formatParts, partsWon, profileFor } from '@/utils/sportProfiles';
import { APP_TIME_ZONE } from '@/utils/date';
import { PoweredByAtm } from '@/components/public';
import PartScoresEditor, { initialParts, toPartScores, type PartDraft } from '@/components/PartScoresEditor';
import { chosen, DeadEnd, fieldClass, GoalBar, GoalRow, NAVY, Notice, playerLabel } from './components/ScorerParts';

/** Live games first, then those still to play, then the finished ones; in time order within each. */
const ORDER: Record<string, number> = { IN_PROGRESS: 0, SCHEDULED: 1, POSTPONED: 2, COMPLETED: 3, CANCELLED: 4 };

/**
 * Where a tournament court's link lands: the games played on one court, kept
 * on a phone by a volunteer without an account. The volunteer opens a game,
 * adds goals with the two big buttons (who scored and assisted is optional),
 * ends it, and moves on to the next one. A volleyball court types set scores.
 */
export default function TournamentScorerScreen() {
	const { token = '' } = useParams<{ token: string }>();
	const [searchParams, setSearchParams] = useSearchParams();
	const openId = searchParams.get('game') ?? undefined;
	const { t, i18n } = useTranslation();

	const [page, setPage] = useState<CourtScorerPage | null>(null);
	const [missing, setMissing] = useState(false);
	const [draft, setDraft] = useState<CourtGoalInput | null>(null);
	const [sets, setSets] = useState<PartDraft[]>([]);
	const [finishing, setFinishing] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	useDocumentTitle([t('courtPage.documentTitle')]);

	const load = (gameId = openId) =>
		scorerApi.court
			.get(token, gameId)
			.then((res) => setPage(res.data))
			.catch(() => setMissing(true));

	useEffect(() => {
		void load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token, openId]);

	const profile = profileFor(page?.tournament.sportType);
	const open = page?.games.find((game) => game.id === openId) ?? null;

	// The set rows start from what is stored each time another game is opened.
	useEffect(() => {
		if (page?.mode === 'SETS' && open) {
			setSets(initialParts(open.periodScores, profile, page.tournament.setFormat ?? undefined, open.phase !== 'GROUP'));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open?.id, page?.mode]);

	const openGame = (gameId: string | null) => {
		setDraft(null);
		setFinishing(false);
		setError('');
		setSearchParams(gameId ? { game: gameId } : {}, { replace: false });
	};

	const failWith = (err: unknown, fallback: string) => {
		const axiosError = err as AxiosError<{ error: string; code?: string }>;
		const status = axiosError.response?.status;
		const code = axiosError.response?.data?.code;
		// The link was cancelled or ran out, or the organiser took the game over,
		// while the page was open: show the page as it now stands.
		if (status === 410 || (status === 409 && code !== 'PLAYOFF_NEEDS_WINNER')) {
			setDraft(null);
			setFinishing(false);
			void load();
		}
		if (code === 'PLAYOFF_NEEDS_WINNER') setError(t('courtPage.needsWinner'));
		else setError(status === 410 ? '' : axiosError.response?.data?.error || fallback);
	};

	const run = async (action: () => Promise<{ data: CourtScorerPage }>, fallback: string) => {
		setError('');
		setBusy(true);
		try {
			setPage((await action()).data);
			return true;
		} catch (err) {
			failWith(err, fallback);
			return false;
		} finally {
			setBusy(false);
		}
	};

	if (missing) {
		return <DeadEnd icon={<SearchX className="size-7" aria-hidden />} title={t('scorerPage.missingTitle')} text={t('courtPage.missingText')} />;
	}
	if (!page) {
		return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t('common.loading')}</div>;
	}

	if (page.status !== 'ACTIVE') {
		const expired = page.status === 'EXPIRED';
		return (
			<DeadEnd
				icon={expired ? <Clock className="size-7" aria-hidden /> : <Ban className="size-7" aria-hidden />}
				title={expired ? t('scorerPage.expiredTitle') : t('scorerPage.revokedTitle')}
				text={t('courtPage.deadText', { court: page.location })}
			/>
		);
	}

	const when = (value: string) =>
		new Date(value).toLocaleString(i18n.language, {
			timeZone: APP_TIME_ZONE,
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});
	const time = (value: string) =>
		new Date(value).toLocaleTimeString(i18n.language, { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
	const stage = (game: CourtGame) =>
		game.phase === 'GROUP'
			? game.groupName
				? t('courtPage.group', { name: game.groupName })
				: null
			: t(`playoff.rounds.${game.phase}`);
	const scoreOf = (game: CourtGame) => `${game.homeScore ?? 0}:${game.awayScore ?? 0}`;

	const header = (
		<div className="flex flex-col gap-0.5">
			<span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
				{t('courtPage.title', { court: page.location })}
				{page.label ? ` · ${page.label}` : ''}
			</span>
			<span className="truncate text-[13px] text-white/85">{page.tournament.name}</span>
		</div>
	);

	// ── The court's games ─────────────────────────────────────────────────────
	if (!open || !open.homeTeam || !open.awayTeam) {
		const games = [...page.games].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));
		return (
			<div className="flex min-h-screen flex-col bg-background">
				<header className="shrink-0 text-white shadow-md" style={{ backgroundColor: NAVY }}>
					<div className="mx-auto flex max-w-xl flex-col gap-1 px-4 py-4">
						{header}
						<span className="text-[12px] text-white/75">{t('courtPage.until', { until: when(page.expiresAt) })}</span>
					</div>
				</header>
				<main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3.5 p-4">
					{games.length === 0 ? (
						<div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
							{t('courtPage.noGames')}
						</div>
					) : (
						<div className="tm-rows-card">
							{games.map((game) => {
								const meta = [game.date ? time(game.date) : null, stage(game), t(`tm.status.${game.status}`)]
									.filter(Boolean)
									.join(' · ');
								const played = game.status === GameStatus.IN_PROGRESS || game.status === GameStatus.COMPLETED;
								return (
									<button
										key={game.id}
										type="button"
										onClick={() => openGame(game.id)}
										disabled={game.block === 'TEAMS_UNKNOWN'}
										className="flex w-full items-center gap-3 px-3.5 py-3 text-left disabled:opacity-60"
									>
										<span className="flex min-w-0 flex-1 flex-col gap-0.5">
											<span className="truncate text-[14.5px] font-semibold">
												{game.homeTeam?.name ?? t('tm.common.tbd')} – {game.awayTeam?.name ?? t('tm.common.tbd')}
											</span>
											<span className="truncate text-[11.5px] text-muted-foreground">{meta}</span>
										</span>
										{played && <span className="shrink-0 text-lg font-bold tabular-nums">{scoreOf(game)}</span>}
										{game.block ? (
											<Lock className="size-4 shrink-0 text-muted-foreground" aria-label={t(`courtPage.block.${game.block}`)} />
										) : (
											<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
										)}
									</button>
								);
							})}
						</div>
					)}
					<div className="mt-auto pt-4">
						<PoweredByAtm />
					</div>
				</main>
			</div>
		);
	}

	// ── One game ──────────────────────────────────────────────────────────────
	const home = open.homeTeam;
	const away = open.awayTeam;
	const teamOf = (teamId: string) => (teamId === home.id ? home : away);
	const editable = open.block === null;
	const finished = open.status === GameStatus.COMPLETED;
	const score = scoreOf(open);
	const goals = page.game?.id === open.id ? page.game.goals : [];
	const roster = draft && page.game ? page.game.rosters[draft.teamId] ?? [] : [];
	const setFormat = page.tournament.setFormat ?? undefined;
	const typedSets = partsWon(toPartScores(sets) ?? []);
	const setsScore = `${typedSets.home}:${typedSets.away}`;

	// After the game ends the court moves on to its next game still to play.
	const next = page.games.find(
		(game) => game.id !== open.id && game.block === null && game.status !== GameStatus.COMPLETED
	);

	const startGoal = (teamId: string) => {
		setError('');
		setFinishing(false);
		setDraft({ teamId, playerId: null, assistPlayerId: null });
	};

	const saveGoal = async () => {
		if (!draft) return;
		if (await run(() => scorerApi.court.addGoal(token, open.id, draft), t('scorerPage.saveError'))) setDraft(null);
	};

	const saveSets = () => run(() => scorerApi.court.setSets(token, open.id, toPartScores(sets) ?? []), t('courtPage.setsError'));

	const finish = async () => {
		// Sets typed but not saved are saved with the end of the game.
		if (page.mode === 'SETS' && !(await saveSets())) return;
		if (await run(() => scorerApi.court.finish(token, open.id), t('scorerPage.finishError'))) setFinishing(false);
	};

	const startFinish = () => {
		setError('');
		setDraft(null);
		setFinishing(true);
	};

	const finishButton = !finished && (
		<button
			type="button"
			onClick={startFinish}
			className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-border text-[14.5px] font-semibold"
		>
			<Flag className="size-4" aria-hidden />
			{t('scorerPage.finish')}
		</button>
	);

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<header className="shrink-0 text-white shadow-md" style={{ backgroundColor: NAVY }}>
				<div className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-4">
					<div className="flex items-start gap-2">
						<button
							type="button"
							onClick={() => openGame(null)}
							className="-ml-1.5 flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
							aria-label={t('courtPage.back')}
						>
							<ChevronLeft className="size-5" aria-hidden />
						</button>
						<div className="min-w-0 flex-1">{header}</div>
					</div>
					<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
						<span className="truncate text-[15px] font-bold">{home.name}</span>
						<span className="text-4xl font-bold tabular-nums">{score}</span>
						<span className="truncate text-right text-[15px] font-bold">{away.name}</span>
					</div>
					<span className="text-[12px] text-white/75">
						{[open.date ? when(open.date) : null, stage(open), t(`tm.status.${open.status}`)].filter(Boolean).join(' · ')}
					</span>
				</div>
			</header>

			<main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3.5 p-4">
				{open.block && <Notice icon={<Lock className="size-4" aria-hidden />}>{t(`courtPage.block.${open.block}`)}</Notice>}
				{editable && finished && (
					<Notice icon={<CheckCircle2 className="size-4" aria-hidden />}>
						{t('courtPage.finished', { until: when(page.expiresAt) })}
					</Notice>
				)}
				{editable && finished && next && (
					<button
						type="button"
						onClick={() => openGame(next.id)}
						className="flex h-12 items-center justify-center gap-1.5 rounded-[10px] text-[15px] font-semibold text-white"
						style={{ backgroundColor: NAVY }}
					>
						{t('courtPage.next', { home: next.homeTeam?.name ?? '', away: next.awayTeam?.name ?? '' })}
						<ChevronRight className="size-4" aria-hidden />
					</button>
				)}

				{page.mode === 'SETS' ? (
					<div className="flex flex-col gap-2.5">
						<div className="flex items-baseline justify-between">
							<span className="tm-section-label">{t('sports.partsTitle.SET')}</span>
							{open.periodScores && open.periodScores.length > 0 && (
								<span className="text-[12.5px] tabular-nums text-muted-foreground">{formatParts(open.periodScores, profile)}</span>
							)}
						</div>
						<PartScoresEditor
							profile={profile}
							rows={sets}
							onChange={setSets}
							readOnly={!editable}
							setFormat={setFormat}
							playoff={open.phase !== 'GROUP'}
						/>
						{editable && !finishing && (
							<div className="flex flex-col gap-2">
								<button
									type="button"
									onClick={() => void saveSets()}
									disabled={busy}
									className="h-12 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
									style={{ backgroundColor: NAVY }}
								>
									{t('courtPage.saveSets')}
								</button>
								{finishButton}
							</div>
						)}
					</div>
				) : goals.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
						{t('scorerPage.empty')}
					</div>
				) : (
					<div className="tm-rows-card">
						{goals.map((goal) => {
							const assist = playerLabel(goal.assistPlayer);
							return (
								<GoalRow
									key={goal.id}
									color={teamOf(goal.teamId).primaryColor}
									title={`${playerLabel(goal.player) ?? t('scorerPage.unattributed')}${assist ? ` (${assist})` : ''}`}
									subtitle={`${teamOf(goal.teamId).name} · ${time(goal.createdAt)}`}
									busy={busy}
									onDelete={
										editable && goal.mine
											? () => void run(() => scorerApi.court.deleteGoal(token, open.id, goal.id), t('scorerPage.deleteError'))
											: undefined
									}
								/>
							);
						})}
					</div>
				)}

				{draft && (
					<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm">
						<span className="tm-section-label">{t('scorerPage.newGoal', { team: teamOf(draft.teamId).name })}</span>
						<label className="flex flex-col gap-1.5">
							<span className="text-[12.5px] font-medium text-muted-foreground">{t('scorerPage.scorer')}</span>
							<select
								value={draft.playerId ?? ''}
								onChange={(e) => setDraft({ ...draft, playerId: e.target.value || null })}
								className={fieldClass}
							>
								<option value="">{t('scorerPage.unattributed')}</option>
								{roster.map((player) => (
									<option key={player.id} value={player.id}>
										{playerLabel(player)}
									</option>
								))}
							</select>
						</label>
						<label className="flex flex-col gap-1.5">
							<span className="text-[12.5px] font-medium text-muted-foreground">{t('scorerPage.assist')}</span>
							<select
								value={draft.assistPlayerId ?? ''}
								onChange={(e) => setDraft({ ...draft, assistPlayerId: e.target.value || null })}
								className={fieldClass}
							>
								<option value="">{t('scorerPage.noAssist')}</option>
								{/* Nobody assists their own goal. */}
								{roster
									.filter((player) => player.id !== draft.playerId)
									.map((player) => (
										<option key={player.id} value={player.id}>
											{playerLabel(player)}
										</option>
									))}
							</select>
						</label>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setDraft(null)}
								className="h-12 flex-1 rounded-[10px] border border-border text-[15px] font-semibold"
							>
								{t('common.cancel')}
							</button>
							<button
								type="button"
								onClick={() => void saveGoal()}
								disabled={busy}
								className="h-12 flex-1 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
								style={chosen(true)}
							>
								{t('scorerPage.saveGoal')}
							</button>
						</div>
					</div>
				)}

				{finishing && (
					<div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
						<span className="tm-section-label">{t('scorerPage.finishTitle')}</span>
						<p className="text-[13px] leading-snug text-muted-foreground">
							{t('courtPage.finishHint', {
								home: home.name,
								away: away.name,
								score: page.mode === 'SETS' ? setsScore : score,
							})}
						</p>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setFinishing(false)}
								className="h-12 flex-1 rounded-[10px] border border-border text-[15px] font-semibold"
							>
								{t('common.cancel')}
							</button>
							<button
								type="button"
								onClick={() => void finish()}
								disabled={busy}
								className="h-12 flex-1 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
								style={{ backgroundColor: NAVY }}
							>
								{t('scorerPage.finishConfirm')}
							</button>
						</div>
					</div>
				)}

				{error && <p className="text-sm text-red-600">{error}</p>}

				<div className="mt-auto pt-4">
					<PoweredByAtm />
				</div>
			</main>

			{page.mode === 'GOALS' && editable && !draft && !finishing && (
				<GoalBar teams={[home, away]} onGoal={startGoal}>
					{finishButton}
				</GoalBar>
			)}
		</div>
	);
}
