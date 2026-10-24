import { useTranslation } from 'react-i18next';
import { Panel } from '@/components/public';
import { partLabel, type SportProfile } from '@/utils/sportProfiles';
import type { GameDetail } from '@types';

type Event = GameDetail['events'][number];

/** What the timeline shows; clock markers, time-outs and shoot-out attempts stay in the report. */
const SHOWN: Event['type'][] = ['GOAL', 'PENALTY', 'CARD', 'GOALIE_CHANGE'];

const clock = (event: Event): string | null =>
	event.minute == null ? null : `${event.minute}:${String(event.second ?? 0).padStart(2, '0')}`;

/** The match report as a timeline, period by period, each event on its team's side. */
export default function Timeline({ detail, profile }: { detail: GameDetail; profile: SportProfile }) {
	const { t } = useTranslation();
	const homeId = detail.game.homeTeam.id;

	// The score as it stood after each goal, counted in report order.
	let home = 0;
	let away = 0;
	const rows = detail.events.filter((event) => SHOWN.includes(event.type)).map((event) => {
		if (event.type === 'GOAL') {
			if (event.teamId === homeId) home++;
			else away++;
		}
		return { event, score: event.type === 'GOAL' ? `${home}:${away}` : null };
	});
	const periods = [...new Set(rows.map((row) => row.event.period))];
	if (rows.length === 0) return null;

	const label = (event: Event): { title: string; detail: string | null; badge: string; tone: string } => {
		const name = event.player?.name ?? t('gameDetail.timeline.unattributed');
		switch (event.type) {
			case 'GOAL': {
				const assists = [event.assistPlayer?.name, event.secondaryAssistPlayer?.name].filter(Boolean).join(', ');
				return {
					title: name,
					detail: assists ? t('gameDetail.timeline.assists', { names: assists }) : t('gameDetail.timeline.noAssist'),
					badge: t('gameDetail.timeline.goal'),
					tone: 'bg-accent text-accent-foreground',
				};
			}
			case 'PENALTY':
				return {
					title: name,
					detail: [event.penaltyType, event.penaltyMinutes ? t('gameDetail.timeline.minutes', { n: event.penaltyMinutes }) : null].filter(Boolean).join(', ') || null,
					badge: event.penaltyMinutes ? `${event.penaltyMinutes}′` : t('gameDetail.timeline.penalty'),
					tone: 'bg-warning-soft text-warning-strong',
				};
			case 'CARD':
				return {
					title: name,
					detail: t(`seasonManagement.report.card.${event.cardColor ?? 'YELLOW'}`),
					badge: event.cardColor === 'RED' ? t('stats.short.redCards') : t('stats.short.yellowCards'),
					tone: event.cardColor === 'RED' ? 'bg-destructive-strong text-white' : 'bg-warning text-warning-foreground',
				};
			default:
				return { title: name, detail: t('gameDetail.timeline.goalieIn'), badge: t('gameDetail.timeline.goalie'), tone: 'bg-muted text-subtle-foreground' };
		}
	};

	return (
		<Panel flush title={t('gameDetail.timeline.title')}>
			{periods.map((period) => {
				const part = partLabel(profile, period - 1);
				const score = detail.game.periodScores?.[period - 1];
				return (
					<div key={period} className="border-b border-border-subtle last:border-0">
						<div className="flex justify-between bg-muted/60 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-subtle-foreground">
							<span>{t(part.key, { n: part.n })}</span>
							{score && <span className="tabular-nums">{score.home}:{score.away}</span>}
						</div>
						<ol>
							{rows.filter((row) => row.event.period === period).map(({ event, score: after }) => {
								const text = label(event);
								const isHome = event.teamId === homeId;
								const badge = (
									<span className={`flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1.5 text-[10.5px] font-extrabold ${text.tone}`}>
										{text.badge}
									</span>
								);
								const body = (
									<span className="flex min-w-0 flex-col gap-0.5">
										<span className="truncate text-sm font-bold">{text.title}</span>
										{text.detail && <span className="truncate text-xs text-muted-foreground">{text.detail}</span>}
									</span>
								);
								return (
									<li key={event.id} className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5">
										<div className="flex min-w-0 items-center justify-end gap-2.5 text-right">
											{isHome && <>{body}{badge}</>}
										</div>
										<div className="flex flex-col items-center">
											{clock(event) && <span className="text-[11px] tabular-nums text-muted-foreground">{clock(event)}</span>}
											{after && <span className="text-[15px] font-extrabold tabular-nums">{after}</span>}
										</div>
										<div className="flex min-w-0 items-center gap-2.5">
											{!isHome && <>{badge}{body}</>}
										</div>
									</li>
								);
							})}
						</ol>
					</div>
				);
			})}
		</Panel>
	);
}
