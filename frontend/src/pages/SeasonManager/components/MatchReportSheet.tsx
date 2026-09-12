import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ShieldAlert, Target, Trash2, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { matchEventApi, playerApi } from '@/services/api';
import { MatchEventType, type Game, type MatchEvent, type MatchEventInput, type Player } from '@types';
import { SEASON_ACCENT } from './util';

interface MatchReportSheetProps {
	game: Game;
	onClose: () => void;
	/** The sheet derives the score, so the caller re-reads the game on close. */
	onChanged: () => void;
}

/**
 * The two event types that carry statistics. The API accepts the rest of the
 * scoresheet vocabulary (timeouts, goalie changes, period markers); nothing is
 * derived from them yet, so they are not worth a button here.
 */
const RECORDABLE = [MatchEventType.GOAL, MatchEventType.PENALTY] as const;
type Recordable = (typeof RECORDABLE)[number];

const PENALTY_MINUTES = [2, 4, 5, 10];
const PERIODS = [1, 2, 3, 4];

const emptyDraft = (teamId: string): MatchEventInput => ({
	type: MatchEventType.GOAL,
	teamId,
	period: 1,
	minute: null,
	playerId: null,
	assistPlayerId: null,
	secondaryAssistPlayerId: null,
	penaltyMinutes: null,
});

export default function MatchReportSheet({ game, onClose, onChanged }: MatchReportSheetProps) {
	const { t } = useTranslation();

	const [events, setEvents] = useState<MatchEvent[]>([]);
	const [rosters, setRosters] = useState<Record<string, Player[]>>({});
	const [loading, setLoading] = useState(true);
	const [draft, setDraft] = useState<MatchEventInput | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const homeTeamId = game.homeTeamId;
	const awayTeamId = game.awayTeamId;

	const load = useCallback(async () => {
		try {
			const [eventsRes, homeRes, awayRes] = await Promise.all([
				matchEventApi.getByGame(game.id),
				playerApi.getByTeam(homeTeamId),
				playerApi.getByTeam(awayTeamId),
			]);
			setEvents(eventsRes.data);
			setRosters({ [homeTeamId]: homeRes.data, [awayTeamId]: awayRes.data });
		} catch {
			setError(t('seasonManagement.report.loadError'));
		} finally {
			setLoading(false);
		}
	}, [game.id, homeTeamId, awayTeamId, t]);

	useEffect(() => {
		void load();
	}, [load]);

	// The score shown here is computed from the log on screen rather than read
	// back from the game, so it matches what the manager just typed without a
	// round trip. The server derives the same figures on every write.
	const score = useMemo(() => {
		let home = 0;
		let away = 0;
		for (const event of events) {
			if (event.type !== MatchEventType.GOAL) continue;
			if (event.teamId === homeTeamId) home++;
			else if (event.teamId === awayTeamId) away++;
		}
		return { home, away };
	}, [events, homeTeamId, awayTeamId]);

	const byPeriod = useMemo(() => {
		const groups = new Map<number, MatchEvent[]>();
		for (const event of events) {
			const bucket = groups.get(event.period) ?? [];
			bucket.push(event);
			groups.set(event.period, bucket);
		}
		return [...groups.entries()].sort((a, b) => a[0] - b[0]);
	}, [events]);

	const teamName = (teamId: string) =>
		(teamId === homeTeamId ? game.homeTeam?.name : game.awayTeam?.name) ?? '—';
	const teamColor = (teamId: string) =>
		(teamId === homeTeamId ? game.homeTeam?.primaryColor : game.awayTeam?.primaryColor) || '#cbd5e1';

	const playerLabel = (player?: { name: string; number?: number | null } | null) =>
		player ? (player.number != null ? `#${player.number} ${player.name}` : player.name) : null;

	const handleSave = async () => {
		if (!draft) return;
		setError('');
		setSaving(true);
		try {
			await matchEventApi.create(game.id, {
				...draft,
				// An empty picker means the detail was not recorded, which the API
				// reads as null rather than as an empty string.
				playerId: draft.playerId || null,
				assistPlayerId: draft.type === MatchEventType.GOAL ? draft.assistPlayerId || null : null,
				secondaryAssistPlayerId:
					draft.type === MatchEventType.GOAL ? draft.secondaryAssistPlayerId || null : null,
				penaltyMinutes: draft.type === MatchEventType.PENALTY ? draft.penaltyMinutes ?? 2 : null,
			});
			const res = await matchEventApi.getByGame(game.id);
			setEvents(res.data);
			setDraft(null);
			onChanged();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('seasonManagement.report.saveError'));
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (event: MatchEvent) => {
		setError('');
		try {
			await matchEventApi.delete(event.id);
			setEvents((prev) => prev.filter((e) => e.id !== event.id));
			onChanged();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('seasonManagement.report.deleteError'));
		}
	};

	const startDraft = (type: Recordable) => {
		setError('');
		setDraft({ ...emptyDraft(homeTeamId), type, penaltyMinutes: type === MatchEventType.PENALTY ? 2 : null });
	};

	const patchDraft = (patch: Partial<MatchEventInput>) =>
		setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

	const draftRoster = draft ? rosters[draft.teamId] ?? [] : [];

	const eventIcon = (type: MatchEventType) =>
		type === MatchEventType.GOAL ? (
			<Target className="size-4" aria-hidden />
		) : (
			<ShieldAlert className="size-4" aria-hidden />
		);

	const describe = (event: MatchEvent): string => {
		if (event.type === MatchEventType.GOAL) {
			const scorer = playerLabel(event.player) ?? t('seasonManagement.report.unattributed');
			const assists = [playerLabel(event.assistPlayer), playerLabel(event.secondaryAssistPlayer)]
				.filter(Boolean)
				.join(', ');
			return assists ? `${scorer} (${assists})` : scorer;
		}
		const who = playerLabel(event.player) ?? t('seasonManagement.report.unattributed');
		return `${who} · ${t('seasonManagement.report.minutes', { n: event.penaltyMinutes ?? 0 })}`;
	};

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-background">
			<div className="tm-team-header shrink-0 text-white shadow-md" style={{ backgroundColor: SEASON_ACCENT }}>
				<div className="flex items-center gap-3 px-4 py-3">
					<button
						onClick={onClose}
						className="-ml-2 flex size-10 items-center justify-center rounded-lg"
						aria-label={t('common.close')}
					>
						<X className="size-5" aria-hidden />
					</button>
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-lg font-bold">{t('seasonManagement.report.title')}</h1>
						<p className="truncate text-xs text-white/85">
							{game.homeTeam?.name} — {game.awayTeam?.name}
						</p>
					</div>
					<span className="shrink-0 text-2xl font-bold tabular-nums">
						{score.home}:{score.away}
					</span>
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
				<p className="text-[12.5px] leading-snug text-muted-foreground">
					{t('seasonManagement.report.derivedNote')}
				</p>

				{loading ? (
					<p className="text-sm text-muted-foreground">{t('common.loading')}</p>
				) : events.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border p-6 text-center">
						<p className="text-sm text-muted-foreground">{t('seasonManagement.report.empty')}</p>
					</div>
				) : (
					byPeriod.map(([period, periodEvents]) => (
						<div key={period} className="flex flex-col gap-2">
							<span className="tm-section-label">
								{t('seasonManagement.report.period', { n: period })}
							</span>
							<div className="tm-rows-card">
								{periodEvents.map((event) => (
									<div key={event.id} className="flex items-center gap-3 px-3.5 py-2.5">
										<span
											className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
											style={{ backgroundColor: teamColor(event.teamId) }}
										>
											{eventIcon(event.type)}
										</span>
										<span className="flex min-w-0 flex-1 flex-col gap-px">
											<span className="truncate text-[14.5px] font-semibold">{describe(event)}</span>
											<span className="truncate text-[11.5px] text-muted-foreground">
												{teamName(event.teamId)}
												{event.minute != null
													? ` · ${t('seasonManagement.report.atMinute', { n: event.minute })}`
													: ''}
											</span>
										</span>
										<button
											onClick={() => void handleDelete(event)}
											className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:opacity-70"
											aria-label={t('common.delete')}
										>
											<Trash2 className="size-4" aria-hidden />
										</button>
									</div>
								))}
							</div>
						</div>
					))
				)}

				{draft && (
					<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm">
						<span className="tm-section-label">
							{draft.type === MatchEventType.GOAL
								? t('seasonManagement.report.newGoal')
								: t('seasonManagement.report.newPenalty')}
						</span>

						<div className="grid grid-cols-2 gap-2">
							{[homeTeamId, awayTeamId].map((teamId) => (
								<button
									key={teamId}
									onClick={() =>
										patchDraft({
											teamId,
											playerId: null,
											assistPlayerId: null,
											secondaryAssistPlayerId: null,
										})
									}
									className="h-11 truncate rounded-[10px] border px-2 text-[13.5px] font-semibold"
									style={
										draft.teamId === teamId
											? { backgroundColor: SEASON_ACCENT, borderColor: SEASON_ACCENT, color: '#ffffff' }
											: undefined
									}
								>
									{teamName(teamId)}
								</button>
							))}
						</div>

						<label className="flex flex-col gap-1.5">
							<span className="text-[12.5px] font-medium text-muted-foreground">
								{draft.type === MatchEventType.GOAL
									? t('seasonManagement.report.scorer')
									: t('seasonManagement.report.penalised')}
							</span>
							<select
								value={draft.playerId ?? ''}
								onChange={(e) => patchDraft({ playerId: e.target.value || null })}
								className="h-11 rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]"
							>
								<option value="">{t('seasonManagement.report.unattributed')}</option>
								{draftRoster.map((player) => (
									<option key={player.id} value={player.id}>
										{playerLabel(player)}
									</option>
								))}
							</select>
						</label>

						{draft.type === MatchEventType.GOAL && (
							<div className="grid grid-cols-2 gap-2">
								{(['assistPlayerId', 'secondaryAssistPlayerId'] as const).map((field, index) => (
									<label key={field} className="flex flex-col gap-1.5">
										<span className="text-[12.5px] font-medium text-muted-foreground">
											{index === 0
												? t('seasonManagement.report.assist')
												: t('seasonManagement.report.secondAssist')}
										</span>
										<select
											value={draft[field] ?? ''}
											onChange={(e) => patchDraft({ [field]: e.target.value || null })}
											className="h-11 rounded-[10px] border border-border bg-input-background px-2 text-[14px]"
										>
											<option value="">{t('seasonManagement.report.noAssist')}</option>
											{draftRoster
												// A player cannot assist their own goal, and cannot be
												// credited with both assists on it.
												.filter(
													(player) =>
														player.id !== draft.playerId &&
														player.id !==
															draft[
																field === 'assistPlayerId'
																	? 'secondaryAssistPlayerId'
																	: 'assistPlayerId'
															]
												)
												.map((player) => (
													<option key={player.id} value={player.id}>
														{playerLabel(player)}
													</option>
												))}
										</select>
									</label>
								))}
							</div>
						)}

						{draft.type === MatchEventType.PENALTY && (
							<div className="flex flex-col gap-1.5">
								<span className="text-[12.5px] font-medium text-muted-foreground">
									{t('seasonManagement.report.penaltyMinutes')}
								</span>
								<div className="grid grid-cols-4 gap-2">
									{PENALTY_MINUTES.map((minutes) => (
										<button
											key={minutes}
											onClick={() => patchDraft({ penaltyMinutes: minutes })}
											className="h-11 rounded-[10px] border text-[13.5px] font-semibold tabular-nums"
											style={
												draft.penaltyMinutes === minutes
													? { backgroundColor: SEASON_ACCENT, borderColor: SEASON_ACCENT, color: '#ffffff' }
													: undefined
											}
										>
											{minutes}
										</button>
									))}
								</div>
							</div>
						)}

						<div className="flex gap-2">
							<label className="flex flex-1 flex-col gap-1.5">
								<span className="text-[12.5px] font-medium text-muted-foreground">
									{t('seasonManagement.report.periodLabel')}
								</span>
								<div className="grid grid-cols-4 gap-1.5">
									{PERIODS.map((period) => (
										<button
											key={period}
											onClick={() => patchDraft({ period })}
											className="h-11 rounded-[10px] border text-[13.5px] font-semibold"
											style={
												draft.period === period
													? { backgroundColor: SEASON_ACCENT, borderColor: SEASON_ACCENT, color: '#ffffff' }
													: undefined
											}
										>
											{period}
										</button>
									))}
								</div>
							</label>
							<label className="flex w-24 flex-col gap-1.5">
								<span className="text-[12.5px] font-medium text-muted-foreground">
									{t('seasonManagement.report.minute')}
								</span>
								<input
									type="number"
									min={0}
									inputMode="numeric"
									value={draft.minute ?? ''}
									onChange={(e) =>
										patchDraft({ minute: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })
									}
									className="sm-score-input h-11 rounded-[10px] bg-input-background text-center text-base font-semibold tabular-nums"
								/>
							</label>
						</div>

						<div className="flex gap-2">
							<button
								onClick={() => setDraft(null)}
								className="h-11 flex-1 rounded-[10px] border border-border text-[14.5px] font-semibold"
							>
								{t('common.cancel')}
							</button>
							<button
								onClick={() => void handleSave()}
								disabled={saving}
								className="h-11 flex-1 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
								style={{ backgroundColor: SEASON_ACCENT }}
							>
								{t('seasonManagement.report.add')}
							</button>
						</div>
					</div>
				)}

				{error && <p className="text-sm text-red-600">{error}</p>}
			</div>

			{!draft && (
				<div className="tm-save-bar shrink-0">
					{RECORDABLE.map((type) => (
						<button
							key={type}
							onClick={() => startDraft(type)}
							className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[14.5px] font-semibold text-white disabled:opacity-60"
							style={{ backgroundColor: type === MatchEventType.GOAL ? SEASON_ACCENT : '#7c2d12' }}
						>
							<Plus className="size-4" aria-hidden />
							{type === MatchEventType.GOAL
								? t('seasonManagement.report.addGoal')
								: t('seasonManagement.report.addPenalty')}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
