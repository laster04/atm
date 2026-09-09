import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, CalendarX2, CheckCircle2, ListPlus, Users } from 'lucide-react';
import { AxiosError } from 'axios';
import { seasonApi } from '@/services/api';
import { GameStatus, SeasonStatus, type Game, type Season } from '@types';
import type { SeasonTab } from '../Detail';
import { SEASON_ACCENT, isPlayed, needsDate } from './util';

interface OverviewTabProps {
	season: Season;
	games: Game[];
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

	// The one blocking thing, in the order a season is actually built up.
	const task = useMemo(() => {
		if (teamCount === 0) {
			return {
				icon: Users,
				title: t('seasonManagement.attention.noTeams'),
				hint: t('seasonManagement.attention.noTeamsHint'),
				action: t('seasonManagement.attention.addTeams'),
				actionIcon: ListPlus,
				run: () => onTabChange('teams'),
			};
		}
		if (games.length === 0) {
			return {
				icon: CalendarX2,
				title: t('seasonManagement.attention.noGames'),
				hint: t('seasonManagement.attention.noGamesHint'),
				action: t('seasonManagement.attention.generate'),
				actionIcon: CalendarPlus,
				run: () => onTabChange('more'),
			};
		}
		if (undatedCount > 0) {
			// Send the manager to the earliest round that still has a gap.
			const undatedRounds = games.filter(needsDate).map((g) => g.round ?? 0);
			const firstRound = Math.min(...undatedRounds);
			return {
				icon: CalendarX2,
				title: t('seasonManagement.attention.noDates', { count: undatedCount }),
				hint: t('seasonManagement.attention.noDatesHint'),
				action: t('seasonManagement.attention.setDates'),
				actionIcon: CalendarPlus,
				run: () => onOpenDates(firstRound),
			};
		}
		return {
			icon: CheckCircle2,
			title: t('seasonManagement.attention.allClear'),
			hint: t('seasonManagement.attention.allClearHint'),
			action: null,
			actionIcon: null,
			run: () => {},
		};
	}, [teamCount, games, undatedCount, t, onTabChange, onOpenDates]);

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

	const TaskIcon = task.icon;
	const ActionIcon = task.actionIcon;

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

			{/* The one thing blocking this season */}
			<div className="flex flex-col gap-2">
				<span className="tm-section-label">{t('seasonManagement.attention.label')}</span>
				<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm">
					<div className="flex items-start gap-3">
						<span
							className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
							style={task.action ? { backgroundColor: '#fef3c7' } : { backgroundColor: '#dcfce7' }}
						>
							<TaskIcon className="size-[19px]" style={{ color: task.action ? '#92400e' : '#166534' }} aria-hidden />
						</span>
						<div className="flex min-w-0 flex-1 flex-col gap-0.5">
							<span className="text-[15px] font-semibold leading-snug">{task.title}</span>
							<span className="text-[12.5px] leading-snug text-muted-foreground">{task.hint}</span>
						</div>
					</div>
					{task.action && (
						<button
							onClick={task.run}
							className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[14.5px] font-semibold text-white"
							style={{ backgroundColor: SEASON_ACCENT }}
						>
							{ActionIcon && <ActionIcon className="size-4" aria-hidden />}
							{task.action}
						</button>
					)}
				</div>
			</div>

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
											{date.toLocaleDateString(i18n.language, { day: 'numeric' })}
										</span>
										<span className="text-[10px] uppercase tracking-wide text-muted-foreground">
											{date.toLocaleDateString(i18n.language, { month: 'short' })}
										</span>
									</span>
									<span className="flex min-w-0 flex-1 flex-col gap-0.5">
										<span className="truncate text-sm font-semibold leading-tight">
											{game.homeTeam?.name} — {game.awayTeam?.name}
										</span>
										<span className="text-[11.5px] text-muted-foreground">
											{date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
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

			{/* Season lifecycle */}
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

			{statusError && <p className="text-sm text-red-600">{statusError}</p>}
		</div>
	);
}
