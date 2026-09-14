import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock } from 'lucide-react';
import { formatDateShort, formatGameTime, isToday, isBeforeToday, isAfterToday } from '@/utils/date';
import { GameStatus, type Game } from '@types';
import { GameStatusBadge, TeamCrest } from '@/components/public';

export enum FilterTimeEnum {
	TODAY = 'today',
	UPCOMING = 'upcoming',
	RECENT = 'recent'
}

interface GameScheduleProps {
	filter?: FilterTimeEnum;
	games: Game[];
}

/**
 * A season's fixtures as rows rather than cards: date and time on the left,
 * the pairing in the middle, status on the right — the same anatomy the public
 * match list uses, so a schedule reads the same wherever it appears.
 */
export function GameSchedule({ filter = FilterTimeEnum.RECENT, games }: GameScheduleProps) {
	const { t, i18n } = useTranslation();

	const filtered =
		filter === FilterTimeEnum.TODAY ? games.filter((game) => isToday(game.date))
		: filter === FilterTimeEnum.UPCOMING ? games.filter((game) => isAfterToday(game.date))
		: games.filter((game) => isBeforeToday(game.date)).reverse();

	if (filtered.length === 0) {
		return (
			<div className="px-5 py-10 text-center text-sm text-muted-foreground">
				{t(`seasonDetail.schedule.empty.${filter}`)}
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			{filtered.map((game) => {
				const scored = game.status !== GameStatus.SCHEDULED;
				const periods = [
					[game.period1HomeScore, game.period1AwayScore],
					[game.period2HomeScore, game.period2AwayScore],
					[game.period3HomeScore, game.period3AwayScore],
				].filter(([home]) => home != null);

				return (
					<div
						key={game.id}
						className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:gap-5"
					>
						<div className="flex items-center gap-3 sm:w-40 sm:shrink-0">
							<span className="flex items-center gap-1.5 text-[13px] font-bold">
								<CalendarDays className="size-3.5 text-muted-foreground" />
								{game.date ? formatDateShort(game.date, i18n.language) : t('public.games.noTime')}
							</span>
							{game.date && (
								<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Clock className="size-3.5" />
									{formatGameTime(game.date, i18n.language)}
								</span>
							)}
						</div>

						<div className="flex flex-1 items-center gap-3">
							<div className="flex flex-1 items-center justify-end gap-2.5 text-right">
								<span className="truncate text-sm font-semibold">{game.homeTeam?.name}</span>
								{game.homeTeam && <TeamCrest team={game.homeTeam} size={30} />}
							</div>

							<div className="flex w-24 shrink-0 flex-col items-center gap-0.5">
								{scored ? (
									<>
										<span className="text-[17px] font-extrabold tabular-nums">
											{game.homeScore ?? 0} : {game.awayScore ?? 0}
										</span>
										{periods.length > 0 && (
											<span className="text-[10px] text-muted-foreground">
												{periods.map(([home, away]) => `${home}:${away}`).join(' · ')}
											</span>
										)}
									</>
								) : (
									<span className="text-xs font-bold text-muted-foreground">{t('common.vs').toUpperCase()}</span>
								)}
							</div>

							<div className="flex flex-1 items-center gap-2.5">
								{game.awayTeam && <TeamCrest team={game.awayTeam} size={30} />}
								<span className="truncate text-sm font-semibold">{game.awayTeam?.name}</span>
							</div>
						</div>

						<div className="flex items-center gap-3 sm:w-44 sm:shrink-0 sm:justify-end">
							{game.round != null && (
								<span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-subtle-foreground">
									{t('seasonDetail.schedule.round', { round: game.round })}
								</span>
							)}
							<GameStatusBadge status={game.status} />
						</div>
					</div>
				);
			})}
		</div>
	);
}
