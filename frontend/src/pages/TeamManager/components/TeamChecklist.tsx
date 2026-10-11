import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { GameStatus, type Team } from '@types';
import { APP_TIME_ZONE } from '@/utils/date';

type ChecklistTab = 'roster' | 'schedule' | 'events' | 'settings';

interface TeamChecklistProps {
	team: Team;
	playerCount: number;
	color: string;
	email: string;
	onTabChange: (tab: ChecklistTab) => void;
}

interface Stored {
	hidden?: boolean;
	/** Steps that are done once looked at; the server has no trace of them. */
	seen?: string[];
}

const storageKey = (teamId: string) => `atm.teamChecklist.${teamId}`;

function read(teamId: string): Stored {
	try {
		return JSON.parse(localStorage.getItem(storageKey(teamId)) ?? '{}') as Stored;
	} catch {
		return {};
	}
}

function write(teamId: string, value: Stored) {
	try {
		localStorage.setItem(storageKey(teamId), JSON.stringify(value));
	} catch {
		// Private mode: the checklist simply comes back next visit.
	}
}

/**
 * A new team manager's first steps, on the screen they will use every week.
 * Steps the data can answer (players, colours) tick themselves; the rest tick
 * once opened. It goes away when everything is done or the manager hides it.
 */
export default function TeamChecklist({ team, playerCount, color, email, onTabChange }: TeamChecklistProps) {
	const { t, i18n } = useTranslation();
	const [stored, setStored] = useState<Stored>(() => read(team.id));

	const update = (next: Stored) => {
		setStored(next);
		write(team.id, next);
	};

	const seen = new Set(stored.seen ?? []);
	const open = (id: string, tab: ChecklistTab) => {
		if (!seen.has(id)) update({ ...stored, seen: [...seen, id] });
		onTabChange(tab);
	};

	const nextGame = (team.games ?? []).find((g) => g.status === GameStatus.SCHEDULED && g.date);
	const opponent = nextGame
		? (nextGame.homeTeamId === team.id ? nextGame.awayTeam?.name : nextGame.homeTeam?.name) ?? ''
		: '';

	const steps = [
		{
			id: 'account',
			title: t('teamChecklist.steps.account.title'),
			hint: t('teamChecklist.steps.account.hint', { email }),
			done: true,
			run: null,
		},
		{
			id: 'look',
			title: t('teamChecklist.steps.look.title'),
			hint: t('teamChecklist.steps.look.hint'),
			done: !!team.primaryColor || !!team.logo || seen.has('look'),
			run: () => open('look', 'settings'),
		},
		{
			id: 'roster',
			title: t('teamChecklist.steps.roster.title'),
			hint: playerCount > 0
				? t('teamChecklist.steps.roster.count', { count: playerCount })
				: t('teamChecklist.steps.roster.hint'),
			done: playerCount > 0,
			run: () => onTabChange('roster'),
		},
		{
			id: 'schedule',
			title: t('teamChecklist.steps.schedule.title'),
			hint: nextGame
				? t('teamChecklist.steps.schedule.next', {
					date: new Date(nextGame.date!).toLocaleDateString(i18n.language, {
						timeZone: APP_TIME_ZONE,
						weekday: 'short',
						day: 'numeric',
						month: 'numeric',
					}),
					opponent,
				})
				: t('teamChecklist.steps.schedule.hint'),
			done: seen.has('schedule'),
			run: () => open('schedule', 'schedule'),
		},
		{
			id: 'training',
			title: t('teamChecklist.steps.training.title'),
			hint: t('teamChecklist.steps.training.hint'),
			done: seen.has('training'),
			run: () => open('training', 'events'),
		},
	];

	const doneCount = steps.filter((step) => step.done).length;
	if (stored.hidden || doneCount === steps.length) return null;

	return (
		<section aria-labelledby="team-checklist" className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 id="team-checklist" className="text-base font-bold">
						{t('teamChecklist.title')}
					</h2>
					<p className="text-[13px] text-muted-foreground">
						{t('teamChecklist.progress', { done: doneCount, total: steps.length })}
					</p>
				</div>
				<button
					type="button"
					onClick={() => update({ ...stored, hidden: true })}
					className="h-9 shrink-0 px-1 text-[13px] font-medium text-muted-foreground"
				>
					{t('teamChecklist.hide')}
				</button>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
				<div className="h-full rounded-full" style={{ width: `${(doneCount / steps.length) * 100}%`, backgroundColor: color }} />
			</div>
			<ol className="flex flex-col">
				{steps.map((step) => {
					const content = (
						<>
							{step.done ? (
								<span className="flex size-[26px] shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>
									<Check className="size-3.5" aria-hidden />
									<span className="sr-only">{t('teamChecklist.done')}</span>
								</span>
							) : (
								<span className="size-[26px] shrink-0 rounded-full border-2 border-border" aria-hidden />
							)}
							<span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
								<span className={`text-[15px] font-semibold ${step.done ? 'text-muted-foreground' : ''}`}>
									{step.title}
								</span>
								<span className="text-[13px] leading-snug text-muted-foreground">{step.hint}</span>
							</span>
							{step.run && !step.done && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
						</>
					);
					return (
						<li key={step.id} className="border-t border-border-subtle">
							{step.run ? (
								<button type="button" onClick={step.run} className="flex min-h-[60px] w-full items-center gap-3 py-2.5">
									{content}
								</button>
							) : (
								<div className="flex min-h-[60px] items-center gap-3 py-2.5">{content}</div>
							)}
						</li>
					);
				})}
			</ol>
			<Link to="/docs/zacinate-jako-manazer-tymu" className="pt-1 text-center text-[13px] font-medium text-primary">
				{t('teamChecklist.guide')}
			</Link>
		</section>
	);
}
