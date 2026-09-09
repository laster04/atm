import { useTranslation } from 'react-i18next';
import type { Standing } from '@types';

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

	return (
		<div className="-mx-4 flex flex-col lg:mx-0 lg:rounded-xl lg:border lg:border-border lg:overflow-hidden">
			<div className="flex h-[34px] items-center gap-2.5 bg-muted px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				<span className="w-5 shrink-0">#</span>
				<span className="-ml-1 w-2 shrink-0" />
				<span className="flex-1">{t('seasonManagement.table.team')}</span>
				<span className="w-6 shrink-0 text-center">{t('seasonManagement.table.played')}</span>
				<span className="w-8 shrink-0 text-right">{t('seasonManagement.table.points')}</span>
			</div>

			<div className="flex flex-col bg-card">
				{standings.map((row, index) => (
					<div
						key={row.team.id}
						className="flex min-h-[60px] items-center gap-2.5 border-b border-border px-4 py-2"
					>
						<span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
							{index + 1}
						</span>
						<span
							className="-ml-1 size-2 shrink-0 rounded-full"
							style={{ backgroundColor: row.team.primaryColor || '#cbd5e1' }}
						/>
						<span className="flex min-w-0 flex-1 flex-col gap-0.5">
							<span className="truncate text-[14.5px] font-semibold leading-tight">{row.team.name}</span>
							<span className="text-[11.5px] tabular-nums text-muted-foreground">
								{row.wins}-{row.draws}-{row.losses} · {row.goalsFor}–{row.goalsAgainst}
							</span>
						</span>
						<span className="w-6 shrink-0 text-center text-sm tabular-nums text-muted-foreground">
							{row.played}
						</span>
						<span className="w-8 shrink-0 text-right text-[17px] font-bold tabular-nums">{row.points}</span>
					</div>
				))}

				{(standings.length === 0 || nothingPlayed) && (
					<p className="p-4 text-xs leading-relaxed text-muted-foreground">
						{t('seasonManagement.table.empty')}
					</p>
				)}
			</div>
		</div>
	);
}
