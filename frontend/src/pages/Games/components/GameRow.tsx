import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Trophy } from 'lucide-react';
import { formatGameTime } from '@/utils/date';
import { GameStatus, type Game } from '@types';
import { GameStatusBadge, TeamCrest } from '@/components/public';

/**
 * One fixture. A finished or running game shows its score where an upcoming one
 * shows "vs", so the column means the same thing down the whole list.
 */
export default function GameRow({ game }: { game: Game }) {
	const { t, i18n } = useTranslation();
	const played = game.status === GameStatus.COMPLETED || game.status === GameStatus.IN_PROGRESS;
	const time = formatGameTime(game.date, i18n.language);

	return (
		<Link
			to={`/season-detail/${game.seasonId}?tab=schedule`}
			className="flex flex-col gap-3 border-t border-border-subtle px-5 py-4 transition-colors first:border-t-0 hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-5"
		>
			<div className="flex w-full items-center gap-3 sm:w-24 sm:shrink-0">
				<span className="text-[13px] font-bold">{time ?? t('public.games.noTime')}</span>
				{game.round != null && (
					<span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-subtle-foreground sm:hidden">
						{t('public.games.round', { round: game.round })}
					</span>
				)}
			</div>

			<div className="flex flex-1 items-center gap-3">
				<div className="flex flex-1 items-center justify-end gap-2.5 text-right">
					<span className="truncate text-sm font-semibold">{game.homeTeam?.name}</span>
					{game.homeTeam && <TeamCrest team={game.homeTeam} size={30} />}
				</div>

				<div className="w-16 shrink-0 text-center">
					{played ? (
						<span className="text-[17px] font-extrabold tabular-nums">
							{game.homeScore ?? 0} : {game.awayScore ?? 0}
						</span>
					) : (
						<span className="text-xs font-bold text-muted-foreground">{t('common.vs').toUpperCase()}</span>
					)}
				</div>

				<div className="flex flex-1 items-center gap-2.5">
					{game.awayTeam && <TeamCrest team={game.awayTeam} size={30} />}
					<span className="truncate text-sm font-semibold">{game.awayTeam?.name}</span>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:w-72 sm:shrink-0 sm:justify-end">
				{/* The list spans every league, so each row says which one it belongs to. */}
				{game.season?.league?.name && (
					<span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
						<Trophy className="size-3.5 shrink-0" />
						<span className="truncate">{game.season.league.name}</span>
					</span>
				)}
				{game.location && (
					<span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
						<MapPin className="size-3.5 shrink-0" />
						<span className="truncate">{game.location}</span>
					</span>
				)}
				<GameStatusBadge status={game.status} />
			</div>
		</Link>
	);
}
