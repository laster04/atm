import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, Check, HelpCircle, MapPin, Trash2, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { teamEventApi } from '@/services/api';
import {
	AttendanceStatus,
	TeamEventType,
	type Attendance,
	type TeamEvent,
	type TeamEventInput,
} from '@types';
import { APP_TIME_ZONE, zonedDayKey, fromZonedInput } from '@/utils/date';

interface EventsTabProps {
	teamId: string;
	teamColor?: string | null;
}

const TYPES: TeamEventType[] = [
	TeamEventType.TRAINING,
	TeamEventType.MATCH,
	TeamEventType.MEETING,
	TeamEventType.OTHER,
];

/** The three answers a player can give. "No response" is a state, not a choice. */
const ANSWERS: { status: AttendanceStatus; icon: typeof Check; tone: string }[] = [
	{ status: AttendanceStatus.ATTENDING, icon: Check, tone: '#166534' },
	{ status: AttendanceStatus.MAYBE, icon: HelpCircle, tone: '#92400e' },
	{ status: AttendanceStatus.NOT_ATTENDING, icon: X, tone: '#991b1b' },
];


export default function EventsTab({ teamId, teamColor }: EventsTabProps) {
	const { t, i18n } = useTranslation();
	const accent = teamColor || '#003E7E';

	const [events, setEvents] = useState<TeamEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [creating, setCreating] = useState(false);
	const [expanded, setExpanded] = useState<string | null>(null);
	const [draft, setDraft] = useState<TeamEventInput>({
		type: TeamEventType.TRAINING,
		title: '',
		startsAt: '',
		location: '',
	});

	const load = useCallback(async () => {
		try {
			const res = await teamEventApi.getByTeam(teamId);
			setEvents(res.data);
		} catch {
			setError(t('teamManagement.events.loadError'));
		} finally {
			setLoading(false);
		}
	}, [teamId, t]);

	useEffect(() => {
		void load();
	}, [load]);

	const upcoming = useMemo(() => {
		const now = Date.now();
		return {
			future: events.filter((event) => new Date(event.startsAt).getTime() >= now),
			past: events.filter((event) => new Date(event.startsAt).getTime() < now).reverse(),
		};
	}, [events]);

	const openCreate = () => {
		// Tomorrow at 18:00, as a day in the app zone.
		const tomorrow = zonedDayKey(new Date(Date.now() + 86400000));
		setDraft({
			type: TeamEventType.TRAINING,
			title: '',
			startsAt: `${tomorrow}T18:00`,
			location: '',
		});
		setError('');
		setCreating(true);
	};

	const create = async () => {
		setError('');
		try {
			await teamEventApi.create(teamId, {
				...draft,
				title: draft.title.trim(),
				// The input gives wall-clock time in the app zone; the API stores an instant.
				startsAt: fromZonedInput(draft.startsAt) ?? draft.startsAt,
				location: draft.location?.trim() || null,
			});
			setCreating(false);
			await load();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('teamManagement.events.saveError'));
		}
	};

	const remove = async (event: TeamEvent) => {
		setError('');
		try {
			await teamEventApi.delete(event.id);
			setEvents((prev) => prev.filter((e) => e.id !== event.id));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('teamManagement.events.deleteError'));
		}
	};

	const answer = async (event: TeamEvent, attendance: Attendance, status: AttendanceStatus) => {
		setError('');
		try {
			const res = await teamEventApi.setAttendance(event.id, attendance.playerId, status);
			setEvents((prev) =>
				prev.map((candidate) =>
					candidate.id !== event.id
						? candidate
						: {
								...candidate,
								attendances: candidate.attendances?.map((row) =>
									row.playerId === attendance.playerId ? { ...row, status: res.data.status } : row
								),
							}
				)
			);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('teamManagement.events.answerError'));
		}
	};

	const counts = (event: TeamEvent) => {
		const rows = event.attendances ?? [];
		return {
			in: rows.filter((row) => row.status === AttendanceStatus.ATTENDING).length,
			maybe: rows.filter((row) => row.status === AttendanceStatus.MAYBE).length,
			out: rows.filter((row) => row.status === AttendanceStatus.NOT_ATTENDING).length,
			waiting: rows.filter((row) => row.status === AttendanceStatus.NO_RESPONSE).length,
		};
	};

	const when = (event: TeamEvent) =>
		new Date(event.startsAt).toLocaleString(i18n.language, { timeZone: APP_TIME_ZONE, 
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});

	const renderEvent = (event: TeamEvent, past: boolean) => {
		const tally = counts(event);
		const open = expanded === event.id;
		return (
			<div key={event.id} className="flex flex-col rounded-xl border border-border bg-card">
				<button
					onClick={() => setExpanded(open ? null : event.id)}
					className="flex items-center gap-3 p-3.5 text-left"
				>
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="truncate text-[15px] font-semibold">{event.title}</span>
						<span className="truncate text-[12px] text-muted-foreground">
							{[when(event), event.location].filter(Boolean).join(' · ')}
						</span>
					</span>
					<span className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold tabular-nums">
						<span style={{ color: '#166534' }}>{tally.in}</span>
						<span className="text-muted-foreground">/</span>
						<span className="text-muted-foreground">
							{tally.in + tally.maybe + tally.out + tally.waiting}
						</span>
					</span>
				</button>

				{open && (
					<div className="flex flex-col gap-2 border-t border-border p-3.5">
						{event.location && (
							<span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
								<MapPin className="size-3.5" aria-hidden />
								{event.location}
							</span>
						)}
						{(event.attendances ?? []).length === 0 ? (
							<p className="text-[13px] text-muted-foreground">
								{t('teamManagement.events.emptyRoster')}
							</p>
						) : (
							(event.attendances ?? []).map((attendance) => (
								<div key={attendance.playerId} className="flex items-center gap-2">
									<span className="min-w-0 flex-1 truncate text-[14px]">
										{attendance.player?.number != null ? `#${attendance.player.number} ` : ''}
										{attendance.player?.name}
									</span>
									<span className="flex shrink-0 gap-1">
										{ANSWERS.map(({ status, icon: Icon, tone }) => {
											const selected = attendance.status === status;
											return (
												<button
													key={status}
													onClick={() => void answer(event, attendance, status)}
													disabled={past}
													className="flex size-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"
													style={selected ? { backgroundColor: tone, borderColor: tone, color: '#ffffff' } : undefined}
													aria-label={t(`teamManagement.events.status.${status}`)}
													aria-pressed={selected}
												>
													<Icon className="size-4" aria-hidden />
												</button>
											);
										})}
									</span>
								</div>
							))
						)}
						{!past && (
							<button
								onClick={() => void remove(event)}
								className="mt-1 flex h-10 items-center justify-center gap-2 rounded-[10px] border border-border text-[14px] font-semibold text-red-600"
							>
								<Trash2 className="size-4" aria-hidden />
								{t('teamManagement.events.delete')}
							</button>
						)}
					</div>
				)}
			</div>
		);
	};

	if (loading) {
		return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
	}

	return (
		<div className="flex flex-col gap-3">
			{error && <p className="text-sm text-red-600">{error}</p>}

			{creating ? (
				<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5">
					<span className="tm-section-label">{t('teamManagement.events.newEvent')}</span>

					<div className="grid grid-cols-4 gap-2">
						{TYPES.map((type) => (
							<button
								key={type}
								onClick={() => setDraft((prev) => ({ ...prev, type }))}
								className="h-10 rounded-[10px] border text-[12.5px] font-semibold"
								style={draft.type === type ? { backgroundColor: accent, borderColor: accent, color: '#ffffff' } : undefined}
							>
								{t(`teamManagement.events.type.${type}`)}
							</button>
						))}
					</div>

					<input
						value={draft.title}
						onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
						placeholder={t('teamManagement.events.titlePlaceholder')}
						className="h-11 rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]"
					/>
					<input
						type="datetime-local"
						value={draft.startsAt}
						onChange={(e) => setDraft((prev) => ({ ...prev, startsAt: e.target.value }))}
						className="h-11 rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]"
					/>
					<input
						value={draft.location ?? ''}
						onChange={(e) => setDraft((prev) => ({ ...prev, location: e.target.value }))}
						placeholder={t('teamManagement.events.locationPlaceholder')}
						className="h-11 rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]"
					/>

					<div className="flex gap-2">
						<button
							onClick={() => setCreating(false)}
							className="h-11 flex-1 rounded-[10px] border border-border text-[14.5px] font-semibold"
						>
							{t('common.cancel')}
						</button>
						<button
							onClick={() => void create()}
							disabled={!draft.title.trim() || !draft.startsAt}
							className="h-11 flex-1 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
							style={{ backgroundColor: accent }}
						>
							{t('common.create')}
						</button>
					</div>
				</div>
			) : (
				<button
					onClick={openCreate}
					className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[14.5px] font-semibold text-white"
					style={{ backgroundColor: accent }}
				>
					<CalendarPlus className="size-4" aria-hidden />
					{t('teamManagement.events.add')}
				</button>
			)}

			{upcoming.future.length === 0 && upcoming.past.length === 0 && (
				<div className="rounded-xl border border-dashed border-border p-6 text-center">
					<p className="text-sm text-muted-foreground">{t('teamManagement.events.empty')}</p>
				</div>
			)}

			{upcoming.future.length > 0 && (
				<div className="flex flex-col gap-2">
					<span className="tm-section-label">{t('teamManagement.events.upcoming')}</span>
					{upcoming.future.map((event) => renderEvent(event, false))}
				</div>
			)}

			{upcoming.past.length > 0 && (
				<div className="flex flex-col gap-2">
					<span className="tm-section-label">{t('teamManagement.events.past')}</span>
					{upcoming.past.map((event) => renderEvent(event, true))}
				</div>
			)}
		</div>
	);
}
