import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, HelpCircle, MapPin, X } from 'lucide-react';
import { teamEventApi } from '@/services/api';
import { AttendanceStatus, type MyTeamEvent } from '@types';
import { APP_TIME_ZONE } from '@/utils/date';

const ANSWERS: { status: AttendanceStatus; icon: typeof Check; tone: string }[] = [
	{ status: AttendanceStatus.ATTENDING, icon: Check, tone: '#166534' },
	{ status: AttendanceStatus.MAYBE, icon: HelpCircle, tone: '#92400e' },
	{ status: AttendanceStatus.NOT_ATTENDING, icon: X, tone: '#991b1b' },
];

/**
 * What the signed-in person has been asked to turn up to, across every team they
 * play for. This is the whole reason a player has an account, so it renders
 * nothing at all rather than an empty card when there is nothing to answer.
 */
export default function MyEventsSection() {
	const { t, i18n } = useTranslation();
	const [events, setEvents] = useState<MyTeamEvent[]>([]);
	const [error, setError] = useState('');

	useEffect(() => {
		teamEventApi
			.getMine()
			.then((res) => setEvents(res.data))
			.catch(() => setError(t('home.myEvents.loadError')));
	}, [t]);

	const answer = async (event: MyTeamEvent, status: AttendanceStatus) => {
		if (!event.myAttendance) return;
		setError('');
		try {
			const res = await teamEventApi.setAttendance(event.id, event.myAttendance.playerId, status);
			setEvents((prev) =>
				prev.map((candidate) =>
					candidate.id === event.id && candidate.myAttendance
						? { ...candidate, myAttendance: { ...candidate.myAttendance, status: res.data.status } }
						: candidate
				)
			);
		} catch {
			setError(t('home.myEvents.answerError'));
		}
	};

	if (events.length === 0) return null;

	return (
		<div className="mb-8">
			<h2 className="mb-3 text-xl font-bold text-gray-900">{t('home.myEvents.title')}</h2>
			{error && <p className="mb-2 text-sm text-red-600">{error}</p>}

			<div className="flex flex-col gap-2">
				{events.map((event) => (
					<div
						key={event.id}
						className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5"
					>
						<span
							className="size-2.5 shrink-0 rounded-full"
							style={{ backgroundColor: event.team.primaryColor || '#cbd5e1' }}
						/>
						<span className="flex min-w-[10rem] flex-1 flex-col gap-0.5">
							<span className="truncate text-[15px] font-semibold">{event.title}</span>
							<span className="truncate text-[12px] text-muted-foreground">
								{[
									event.team.name,
									new Date(event.startsAt).toLocaleString(i18n.language, { timeZone: APP_TIME_ZONE, 
										weekday: 'short',
										day: 'numeric',
										month: 'short',
										hour: '2-digit',
										minute: '2-digit',
									}),
								].join(' · ')}
							</span>
							{event.location && (
								<span className="flex items-center gap-1 text-[12px] text-muted-foreground">
									<MapPin className="size-3" aria-hidden />
									{event.location}
								</span>
							)}
						</span>

						<span className="flex shrink-0 gap-1.5">
							{ANSWERS.map(({ status, icon: Icon, tone }) => {
								const selected = event.myAttendance?.status === status;
								return (
									<button
										key={status}
										onClick={() => void answer(event, status)}
										className="flex size-10 items-center justify-center rounded-lg border border-border"
										style={selected ? { backgroundColor: tone, borderColor: tone, color: '#ffffff' } : undefined}
										aria-label={t(`home.myEvents.status.${status}`)}
										aria-pressed={selected}
									>
										<Icon className="size-4" aria-hidden />
									</button>
								);
							})}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
