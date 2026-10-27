import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ban, CheckCircle2, Clock, Flag, Lock, Plus, SearchX, Target, Trash2 } from 'lucide-react';
import { AxiosError } from 'axios';
import { scorerApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { GameStatus, MatchEventType, type ScorerGoalInput, type ScorerPage } from '@types';
import { partLabel, profileFor } from '@/utils/sportProfiles';
import { APP_TIME_ZONE } from '@/utils/date';
import { PoweredByAtm } from '@/components/public';

const NAVY = '#0F172A';

type PlayerRef = { name: string; number?: number | null };

const playerLabel = (player?: PlayerRef | null) =>
	player ? (player.number != null ? `#${player.number} ${player.name}` : player.name) : null;

/**
 * Where a scorer link lands: one game's goals, kept on a phone by someone
 * without an account. Two big buttons add a goal for either team; who scored
 * and the minute are optional, since an amateur scoresheet often lacks them.
 * The score follows from the goals, as it does for the season manager.
 */
export default function ScorerScreen() {
	const { token = '' } = useParams<{ token: string }>();
	const { t, i18n } = useTranslation();

	const [page, setPage] = useState<ScorerPage | null>(null);
	const [missing, setMissing] = useState(false);
	const [draft, setDraft] = useState<ScorerGoalInput | null>(null);
	const [lastPeriod, setLastPeriod] = useState(1);
	const [finishing, setFinishing] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	useDocumentTitle([t('scorerPage.documentTitle')]);

	const load = () =>
		scorerApi
			.get(token)
			.then((res) => setPage(res.data))
			.catch(() => setMissing(true));

	useEffect(() => {
		void load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token]);

	const profile = profileFor(page?.game.sportType);
	const periods = Array.from({ length: profile.parts.max }, (_, i) => i + 1);
	// Hockey and floorball credit two assists, football one.
	const assistFields =
		profile.parts.kind === 'PERIOD'
			? (['assistPlayerId', 'secondaryAssistPlayerId'] as const)
			: (['assistPlayerId'] as const);

	const byPeriod = useMemo(() => {
		const groups = new Map<number, ScorerPage['events']>();
		for (const event of page?.events ?? []) {
			if (event.type !== MatchEventType.GOAL) continue;
			groups.set(event.period, [...(groups.get(event.period) ?? []), event]);
		}
		return [...groups.entries()].sort((a, b) => a[0] - b[0]);
	}, [page?.events]);

	const failWith = (err: unknown, fallback: string) => {
		const axiosError = err as AxiosError<{ error: string; code?: string }>;
		const status = axiosError.response?.status;
		// The link was cancelled or ran out, or the game was confirmed, while
		// the page was open: show the page as it now stands.
		if (status === 410 || status === 409) {
			setDraft(null);
			setFinishing(false);
			void load();
		}
		setError(status === 410 ? '' : axiosError.response?.data?.error || fallback);
	};

	const run = async (action: () => Promise<{ data: ScorerPage }>, fallback: string) => {
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
		return (
			<DeadEnd icon={<SearchX className="size-7" aria-hidden />} title={t('scorerPage.missingTitle')} text={t('scorerPage.missingText')} />
		);
	}
	if (!page) {
		return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t('common.loading')}</div>;
	}

	const { game } = page;
	const teams = [game.homeTeam, game.awayTeam];
	const teamOf = (teamId: string) => (teamId === game.homeTeam.id ? game.homeTeam : game.awayTeam);
	const when = (value: string) =>
		new Date(value).toLocaleString(i18n.language, {
			timeZone: APP_TIME_ZONE,
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});

	if (page.status !== 'ACTIVE') {
		const expired = page.status === 'EXPIRED';
		return (
			<DeadEnd
				icon={expired ? <Clock className="size-7" aria-hidden /> : <Ban className="size-7" aria-hidden />}
				title={expired ? t('scorerPage.expiredTitle') : t('scorerPage.revokedTitle')}
				text={t('scorerPage.deadText', { home: game.homeTeam.name, away: game.awayTeam.name })}
			/>
		);
	}

	const editable = page.block === null;
	const finished = game.status === GameStatus.COMPLETED;
	const score = `${game.homeScore ?? 0}:${game.awayScore ?? 0}`;
	const roster = draft ? page.rosters[draft.teamId] ?? [] : [];

	const startGoal = (teamId: string) => {
		setError('');
		setFinishing(false);
		setDraft({
			teamId,
			period: lastPeriod,
			minute: null,
			playerId: null,
			assistPlayerId: null,
			secondaryAssistPlayerId: null,
		});
	};
	const patch = (next: Partial<ScorerGoalInput>) => setDraft((prev) => (prev ? { ...prev, ...next } : prev));

	const saveGoal = async () => {
		if (!draft) return;
		if (await run(() => scorerApi.addGoal(token, draft), t('scorerPage.saveError'))) {
			setLastPeriod(draft.period);
			setDraft(null);
		}
	};

	const field = 'h-12 rounded-[10px] border border-border bg-input-background px-3 text-[15px]';
	const choice = (selected: boolean) =>
		selected ? { backgroundColor: NAVY, borderColor: NAVY, color: '#ffffff' } : undefined;

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<header className="shrink-0 text-white shadow-md" style={{ backgroundColor: NAVY }}>
				<div className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-4">
					<div className="flex flex-col gap-0.5">
						<span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
							{t('scorerPage.title')}
							{page.label ? ` · ${page.label}` : ''}
						</span>
						<span className="truncate text-[13px] text-white/85">
							{[game.leagueName, game.seasonName].join(' · ')}
						</span>
					</div>
					<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
						<span className="truncate text-[15px] font-bold">{game.homeTeam.name}</span>
						<span className="text-4xl font-bold tabular-nums">{score}</span>
						<span className="truncate text-right text-[15px] font-bold">{game.awayTeam.name}</span>
					</div>
					<span className="text-[12px] text-white/75">
						{[game.date ? when(game.date) : null, game.location, t(`tm.status.${game.status}`)]
							.filter(Boolean)
							.join(' · ')}
					</span>
				</div>
			</header>

			<main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3.5 p-4">
				{page.block && (
					<Notice icon={<Lock className="size-4" aria-hidden />}>{t(`scorerPage.block.${page.block}`)}</Notice>
				)}
				{editable && finished && (
					<Notice icon={<CheckCircle2 className="size-4" aria-hidden />}>
						{page.outcome === 'CONFIRMED'
							? t('scorerPage.finishedConfirmed')
							: t('scorerPage.finished', { until: when(page.expiresAt) })}
					</Notice>
				)}

				{byPeriod.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
						{t('scorerPage.empty')}
					</div>
				) : (
					byPeriod.map(([period, goals]) => {
						const part = partLabel(profile, period - 1);
						return (
							<section key={period} className="flex flex-col gap-2">
								<span className="tm-section-label">{t(part.key, { n: part.n })}</span>
								<div className="tm-rows-card">
									{goals.map((event) => {
										const assists = [playerLabel(event.assistPlayer), playerLabel(event.secondaryAssistPlayer)]
											.filter(Boolean)
											.join(', ');
										return (
											<div key={event.id} className="flex items-center gap-3 px-3.5 py-2.5">
												<span
													className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
													style={{ backgroundColor: teamOf(event.teamId).primaryColor || '#94a3b8' }}
												>
													<Target className="size-4" aria-hidden />
												</span>
												<span className="flex min-w-0 flex-1 flex-col gap-px">
													<span className="truncate text-[14.5px] font-semibold">
														{playerLabel(event.player) ?? t('scorerPage.unattributed')}
														{assists ? ` (${assists})` : ''}
													</span>
													<span className="truncate text-[11.5px] text-muted-foreground">
														{teamOf(event.teamId).name}
														{event.minute != null ? ` · ${t('scorerPage.atMinute', { n: event.minute })}` : ''}
													</span>
												</span>
												{editable && event.mine && (
													<button
														onClick={() => void run(() => scorerApi.deleteGoal(token, event.id), t('scorerPage.deleteError'))}
														disabled={busy}
														className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:opacity-70 disabled:opacity-50"
														aria-label={t('scorerPage.deleteGoal')}
													>
														<Trash2 className="size-4" aria-hidden />
													</button>
												)}
											</div>
										);
									})}
								</div>
							</section>
						);
					})
				)}

				{draft && (
					<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm">
						<span className="tm-section-label">{t('scorerPage.newGoal', { team: teamOf(draft.teamId).name })}</span>

						<label className="flex flex-col gap-1.5">
							<span className="text-[12.5px] font-medium text-muted-foreground">{t('scorerPage.scorer')}</span>
							<select
								value={draft.playerId ?? ''}
								onChange={(e) => patch({ playerId: e.target.value || null })}
								className={field}
							>
								<option value="">{t('scorerPage.unattributed')}</option>
								{roster.map((player) => (
									<option key={player.id} value={player.id}>
										{playerLabel(player)}
									</option>
								))}
							</select>
						</label>

						<div className={`grid gap-2 ${assistFields.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
							{assistFields.map((key, index) => {
								const other = key === 'assistPlayerId' ? draft.secondaryAssistPlayerId : draft.assistPlayerId;
								return (
									<label key={key} className="flex flex-col gap-1.5">
										<span className="text-[12.5px] font-medium text-muted-foreground">
											{index === 0 ? t('scorerPage.assist') : t('scorerPage.secondAssist')}
										</span>
										<select
											value={draft[key] ?? ''}
											onChange={(e) => patch({ [key]: e.target.value || null })}
											className={`${field} px-2 text-[14px]`}
										>
											<option value="">{t('scorerPage.noAssist')}</option>
											{/* Nobody assists their own goal, or twice on one goal. */}
											{roster
												.filter((player) => player.id !== draft.playerId && player.id !== other)
												.map((player) => (
													<option key={player.id} value={player.id}>
														{playerLabel(player)}
													</option>
												))}
										</select>
									</label>
								);
							})}
						</div>

						<div className="flex gap-2">
							<div className="flex flex-1 flex-col gap-1.5">
								<span className="text-[12.5px] font-medium text-muted-foreground">
									{t(`sports.partsTitle.${profile.parts.kind}`)}
								</span>
								<div
									className="grid gap-1.5"
									style={{ gridTemplateColumns: `repeat(${Math.min(periods.length, 5)}, minmax(0, 1fr))` }}
								>
									{periods.map((period) => (
										<button
											key={period}
											type="button"
											onClick={() => patch({ period })}
											className="h-12 rounded-[10px] border text-[14px] font-semibold"
											style={choice(draft.period === period)}
										>
											{period}
										</button>
									))}
								</div>
							</div>
							<label className="flex w-24 flex-col gap-1.5">
								<span className="text-[12.5px] font-medium text-muted-foreground">{t('scorerPage.minute')}</span>
								<input
									type="number"
									min={0}
									inputMode="numeric"
									value={draft.minute ?? ''}
									onChange={(e) => patch({ minute: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
									className="h-12 rounded-[10px] border border-border bg-input-background text-center text-base font-semibold tabular-nums"
								/>
							</label>
						</div>

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
								style={{ backgroundColor: NAVY }}
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
							{t('scorerPage.finishHint', { home: game.homeTeam.name, away: game.awayTeam.name, score })}
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
								onClick={() =>
									void run(() => scorerApi.finish(token), t('scorerPage.finishError')).then((ok) => ok && setFinishing(false))
								}
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

			{editable && !draft && !finishing && (
				<div className="sticky bottom-0 shrink-0 border-t border-border bg-background/95 backdrop-blur">
					<div className="mx-auto flex max-w-xl flex-col gap-2 px-4 py-3">
						<div className="grid grid-cols-2 gap-2">
							{teams.map((team) => (
								<button
									key={team.id}
									type="button"
									onClick={() => startGoal(team.id)}
									className="flex h-14 min-w-0 items-center justify-center gap-1.5 rounded-[12px] px-2 text-[15px] font-bold text-white"
									style={{ backgroundColor: team.primaryColor || NAVY }}
								>
									<Plus className="size-4 shrink-0" aria-hidden />
									<span className="truncate">{t('scorerPage.goalFor', { team: team.name })}</span>
								</button>
							))}
						</div>
						{!finished && (
							<button
								type="button"
								onClick={() => {
									setError('');
									setFinishing(true);
								}}
								className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-border text-[14.5px] font-semibold"
							>
								<Flag className="size-4" aria-hidden />
								{t('scorerPage.finish')}
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5">
			<span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
			<p className="text-[13px] leading-snug">{children}</p>
		</div>
	);
}

function DeadEnd({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
			<span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</span>
			<h1 className="text-lg font-bold">{title}</h1>
			<p className="max-w-sm text-sm text-muted-foreground">{text}</p>
		</div>
	);
}
