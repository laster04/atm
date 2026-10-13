import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { AxiosError } from 'axios';
import { seasonApi } from '@/services/api';
import { GameStatus, SeasonStatus, type Game, type ManagerInvite, type Season, type Team } from '@types';
import type { SeasonTab } from '../Detail';
import { SEASON_ACCENT, isPlayed, needsDate } from './util';
import VisibilityCard from './VisibilityCard';
import SetupChecklist, { type SetupStep } from '@/components/SetupChecklist';
import { invitesByTarget, managerState } from '@/components/invite/inviteState';
import { APP_TIME_ZONE } from '@/utils/date';

/** Per season and browser: the manager chose to run the teams themselves. */
const skipManagersKey = (seasonId: string) => `atm.seasonChecklist.skipManagers.${seasonId}`;

function readSkip(seasonId: string): boolean {
	try {
		return localStorage.getItem(skipManagersKey(seasonId)) === '1';
	} catch {
		return false;
	}
}

interface OverviewTabProps {
	season: Season;
	games: Game[];
	teams: Team[];
	invites: ManagerInvite[];
	teamCount: number;
	undatedCount: number;
	onTabChange: (tab: SeasonTab) => void;
	onOpenDates: (round: number) => void;
	onOpenResult: (game: Game) => void;
	onSeasonChange: (season: Season) => void;
}

export default function OverviewTab({
	season,
	games,
	teams,
	invites,
	teamCount,
	undatedCount,
	onTabChange,
	onOpenDates,
	onOpenResult,
	onSeasonChange,
}: OverviewTabProps) {
	const { t, i18n } = useTranslation();
	const [statusError, setStatusError] = useState('');
	const [savingStatus, setSavingStatus] = useState(false);

	// The API sorts fixtures soonest-first with undated ones last.
	const nextUp = useMemo(
		() => games.filter((g) => g.date && g.status === GameStatus.SCHEDULED).slice(0, 3),
		[games]
	);

	const changeStatus = async (status: SeasonStatus) => {
		setStatusError('');
		setSavingStatus(true);
		try {
			const res = await seasonApi.update(season.id, { status });
			onSeasonChange(res.data);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setStatusError(axiosError.response?.data?.error || t('seasonManagement.publish.error'));
		} finally {
			setSavingStatus(false);
		}
	};

	const [skipManagers, setSkipManagers] = useState(() => readSkip(season.id));

	// Getting the season live, in the order it is actually built up.
	const steps = useMemo<SetupStep[]>(() => {
		const inviteFor = invitesByTarget(invites, 'teamId');
		const tally = { ACTIVE: 0, INVITED: 0, EXPIRED: 0, NONE: 0 };
		teams.forEach((team) => {
			tally[managerState(team.managerId ?? team.manager?.id, inviteFor.get(team.id))] += 1;
		});
		const undatedRounds = games.filter(needsDate).map((g) => g.round ?? 0);
		return [
			{
				id: 'teams',
				title: t('seasonChecklist.steps.teams.title'),
				status: teamCount > 0
					? t('seasonChecklist.steps.teams.status', { count: teamCount })
					: t('seasonChecklist.steps.teams.none'),
				body: t('seasonChecklist.steps.teams.body'),
				action: t('seasonChecklist.steps.teams.action'),
				run: () => onTabChange('teams'),
				done: teamCount > 0,
			},
			{
				id: 'managers',
				title: t('seasonChecklist.steps.managers.title'),
				status: t('seasonChecklist.steps.managers.status', {
					active: tally.ACTIVE,
					invited: tally.INVITED + tally.EXPIRED,
					missing: tally.NONE,
				}),
				body: t('seasonChecklist.steps.managers.body'),
				action: t('seasonChecklist.steps.managers.action', { count: tally.NONE }),
				run: () => onTabChange('teams'),
				// Expired invites still count as asked: the Teams tab offers the resend.
				done: skipManagers || (teams.length > 0 && tally.NONE === 0),
				skip: {
					label: t('seasonChecklist.steps.managers.skip'),
					run: () => {
						try {
							localStorage.setItem(skipManagersKey(season.id), '1');
						} catch {
							// Private mode: the skip lasts until the page is left.
						}
						setSkipManagers(true);
					},
				},
			},
			{
				id: 'schedule',
				title: t('seasonChecklist.steps.schedule.title'),
				status: games.length > 0
					? t('seasonChecklist.steps.schedule.status', { count: games.length })
					: t('seasonChecklist.steps.schedule.none'),
				body: t('seasonChecklist.steps.schedule.body'),
				action: t('seasonChecklist.steps.schedule.action'),
				run: () => onTabChange('more'),
				done: games.length > 0,
			},
			{
				id: 'dates',
				title: t('seasonChecklist.steps.dates.title'),
				status: t('seasonChecklist.steps.dates.status', { undated: undatedCount, total: games.length }),
				body: t('seasonChecklist.steps.dates.body'),
				action: t('seasonChecklist.steps.dates.action'),
				// Send the manager to the earliest round that still has a gap.
				run: () => onOpenDates(undatedRounds.length ? Math.min(...undatedRounds) : 1),
				done: games.length > 0 && undatedCount === 0,
			},
			{
				id: 'publish',
				title: t('seasonChecklist.steps.publish.title'),
				status: season.status === SeasonStatus.DRAFT
					? t('seasonChecklist.steps.publish.draft')
					: t('seasonChecklist.steps.publish.live'),
				body: t('seasonChecklist.steps.publish.body'),
				action: t('seasonChecklist.steps.publish.action'),
				run: () => void changeStatus(SeasonStatus.ACTIVE),
				done: season.status !== SeasonStatus.DRAFT,
				busy: savingStatus,
			},
		];
		// changeStatus is recreated each render but only reads its argument.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [t, teams, invites, games, teamCount, undatedCount, season.id, season.status, skipManagers, savingStatus, onTabChange, onOpenDates]);
	const setupDone = steps.every((step) => step.done);

	const lifecycle = {
		[SeasonStatus.DRAFT]: {
			title: t('seasonManagement.publish.title'),
			hint: t('seasonManagement.publish.hint'),
			action: t('seasonManagement.publish.action'),
			tone: { bg: '#dcfce7', fg: '#166534' },
			next: SeasonStatus.ACTIVE,
		},
		[SeasonStatus.ACTIVE]: {
			title: t('seasonManagement.publish.liveTitle'),
			hint: t('seasonManagement.publish.liveHint'),
			action: t('seasonManagement.publish.complete'),
			tone: { bg: '#e5e7eb', fg: '#374151' },
			next: SeasonStatus.COMPLETED,
		},
		[SeasonStatus.COMPLETED]: {
			title: t('seasonManagement.publish.completedTitle'),
			hint: t('seasonManagement.publish.completedHint'),
			action: null,
			tone: { bg: '#e5e7eb', fg: '#374151' },
			next: null,
		},
	}[season.status];

	return (
		<div className="flex flex-col gap-4">
			{/* The counts ride in the coloured header on a phone; the desktop layout
			    has no such header, so they get a row of their own there. */}
			<div className="hidden grid-cols-3 gap-2 lg:grid">
				{[
					{ value: teamCount, label: t('seasonManagement.stats.teams') },
					{ value: games.length, label: t('seasonManagement.stats.games') },
					{ value: games.filter(isPlayed).length, label: t('seasonManagement.stats.played') },
				].map((tile) => (
					<div
						key={tile.label}
						className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-card py-2.5"
					>
						<span className="text-lg font-bold leading-none tabular-nums">{tile.value}</span>
						<span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
							{tile.label}
						</span>
					</div>
				))}
			</div>

			{setupDone ? (
				<div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm">
					<span className="flex size-9 shrink-0 items-center justify-center rounded-[10px]" style={{ backgroundColor: '#dcfce7' }}>
						<CheckCircle2 className="size-[19px]" style={{ color: '#166534' }} aria-hidden />
					</span>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-[15px] font-semibold leading-snug">{t('seasonManagement.attention.allClear')}</span>
						<span className="text-[12.5px] leading-snug text-muted-foreground">{t('seasonManagement.attention.allClearHint')}</span>
					</div>
				</div>
			) : (
				<SetupChecklist
					steps={steps}
					title={t('seasonChecklist.title')}
					accent={SEASON_ACCENT}
					guide={{ to: '/docs/zacinate-jako-manazer-sezony', label: t('seasonChecklist.guide') }}
				/>
			)}

			<VisibilityCard season={season} onSeasonChange={onSeasonChange} />

			{/* Next up */}
			<div className="flex flex-col gap-2">
				<div className="flex items-baseline justify-between">
					<span className="tm-section-label">{t('seasonManagement.nextUp.label')}</span>
					{games.length > 0 && (
						<button
							onClick={() => onTabChange('games')}
							className="text-[13px] font-medium"
							style={{ color: SEASON_ACCENT }}
						>
							{t('seasonManagement.nextUp.all', { count: games.length })}
						</button>
					)}
				</div>

				{nextUp.length === 0 ? (
					<div className="rounded-xl border border-border bg-card p-3.5 text-sm text-muted-foreground">
						{t('seasonManagement.nextUp.empty')}
					</div>
				) : (
					<div className="tm-rows-card">
						{nextUp.map((game) => {
							const date = new Date(game.date!);
							return (
								<div key={game.id} className="flex items-center gap-3 px-3 py-2.5">
									<span className="flex w-[42px] shrink-0 flex-col items-center gap-px">
										<span className="text-[15px] font-bold leading-none tabular-nums">
											{date.toLocaleDateString(i18n.language, { timeZone: APP_TIME_ZONE,  day: 'numeric' })}
										</span>
										<span className="text-[10px] uppercase tracking-wide text-muted-foreground">
											{date.toLocaleDateString(i18n.language, { timeZone: APP_TIME_ZONE,  month: 'short' })}
										</span>
									</span>
									<span className="flex min-w-0 flex-1 flex-col gap-0.5">
										<span className="truncate text-sm font-semibold leading-tight">
											{game.homeTeam?.name} — {game.awayTeam?.name}
										</span>
										<span className="text-[11.5px] text-muted-foreground">
											{date.toLocaleTimeString(i18n.language, { timeZone: APP_TIME_ZONE,  hour: '2-digit', minute: '2-digit' })}
											{game.location ? ` · ${game.location}` : ''}
										</span>
									</span>
									<button
										onClick={() => onOpenResult(game)}
										className="h-9 shrink-0 rounded-[9px] border border-border px-3 text-[12.5px] font-semibold"
									>
										{t('seasonManagement.games.result')}
									</button>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Season lifecycle; while setting up, publishing is the checklist's last step. */}
			{(setupDone || season.status !== SeasonStatus.DRAFT) && (
			<div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="text-sm font-semibold">{lifecycle.title}</span>
					<span className="text-xs text-muted-foreground">{lifecycle.hint}</span>
				</div>
				{lifecycle.action && lifecycle.next && (
					<button
						onClick={() => changeStatus(lifecycle.next!)}
						disabled={savingStatus}
						className="h-9 shrink-0 rounded-[9px] px-3.5 text-[13px] font-semibold disabled:opacity-60"
						style={{ backgroundColor: lifecycle.tone.bg, color: lifecycle.tone.fg }}
					>
						{lifecycle.action}
					</button>
				)}
			</div>
			)}

			{statusError && <p className="text-sm text-red-600">{statusError}</p>}
		</div>
	);
}
