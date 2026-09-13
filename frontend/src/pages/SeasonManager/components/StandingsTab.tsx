import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Radio } from 'lucide-react';
import type { Standing } from '@types';
import { hasLiveGames, liveTone } from '@/utils/liveTable';

interface StandingsTabProps {
	standings: Standing[];
}

/**
 * Only P and Pts get a column of their own; the W-D-L record and the goal
 * count ride under the team name, which is what keeps the row readable at
 * 390px without a horizontal scroller.
 */
export default function StandingsTab({ standings }: StandingsTabProps) {
	const { t } = useTranslation();
	const nothingPlayed = standings.every((row) => row.played === 0);
	const live = hasLiveGames(standings);

	return (
		<div className="-mx-4 flex flex-col lg:mx-0 lg:rounded-xl lg:border lg:border-border lg:overflow-hidden">
			{/* The table itself stays the official one. What is being played is shown
			    as the move it would cause, not by quietly reordering the rows. */}
			{live && (
				<div className="flex items-center gap-2 bg-card px-4 py-2.5 text-[12px] text-muted-foreground">
					<Radio className="size-3.5 shrink-0 animate-pulse text-red-600" aria-hidden />
					<span>{t('seasonManagement.table.liveHint')}</span>
				</div>
			)}
			<div className="flex h-[34px] items-center gap-2.5 bg-muted px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				<span className="w-5 shrink-0">#</span>
				<span className="-ml-1 w-2 shrink-0" />
				<span className="flex-1">{t('seasonManagement.table.team')}</span>
				<span className="w-6 shrink-0 text-center">{t('seasonManagement.table.played')}</span>
				<span className="w-8 shrink-0 text-right">{t('seasonManagement.table.points')}</span>
			</div>

			<div className="flex flex-col bg-card">
				{standings.map((row) => {
					const tone = liveTone(row);
					return (
					<div
						key={row.team.id}
						className="flex min-h-[60px] items-center gap-2.5 border-b border-border px-4 py-2"
						style={tone.background ? { backgroundColor: tone.background } : undefined}
					>
						<span className="flex w-5 shrink-0 flex-col items-center">
							<span className="text-sm font-semibold tabular-nums text-muted-foreground">
								{row.rank}
							</span>
							{tone.direction !== 0 && (
								<span
									className="flex items-center text-[10px] font-bold tabular-nums"
									style={{ color: tone.direction === 1 ? '#166534' : '#991b1b' }}
									title={t(
										tone.direction === 1
											? 'seasonManagement.table.wouldClimb'
											: 'seasonManagement.table.wouldDrop',
										{ places: tone.places, rank: row.live?.rank }
									)}
								>
									{tone.direction === 1 ? (
										<ArrowUp className="size-3" aria-hidden />
									) : (
										<ArrowDown className="size-3" aria-hidden />
									)}
									{tone.places}
								</span>
							)}
						</span>
						<span
							className="-ml-1 size-2 shrink-0 rounded-full"
							style={{ backgroundColor: row.team.primaryColor || '#cbd5e1' }}
						/>
						<span className="flex min-w-0 flex-1 flex-col gap-0.5">
							<span className="flex items-center gap-1.5">
								<span className="truncate text-[14.5px] font-semibold leading-tight">
									{row.team.name}
								</span>
								{tone.inPlay && (
									<span
										className="shrink-0 rounded-full bg-red-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
										title={t('seasonManagement.table.playingNow')}
									>
										{t('seasonManagement.table.liveTag')}
									</span>
								)}
							</span>
							<span className="text-[11.5px] tabular-nums text-muted-foreground">
								{row.wins}-{row.draws}-{row.losses} · {row.goalsFor}–{row.goalsAgainst}
							</span>
						</span>
						<span className="w-6 shrink-0 text-center text-sm tabular-nums text-muted-foreground">
							{row.played}
						</span>
						<span className="flex w-8 shrink-0 flex-col items-end">
							<span className="text-[17px] font-bold tabular-nums">{row.points}</span>
							{row.live && row.live.points !== row.points && (
								<span className="text-[10.5px] font-semibold tabular-nums text-muted-foreground">
									{row.live.points}
								</span>
							)}
						</span>
					</div>
					);
				})}

				{(standings.length === 0 || nothingPlayed) && (
					<p className="p-4 text-xs leading-relaxed text-muted-foreground">
						{t('seasonManagement.table.empty')}
					</p>
				)}
			</div>
		</div>
	);
}
