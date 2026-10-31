import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Trophy } from 'lucide-react';
import { formatGameTime } from '@/utils/date';
import { gamePage } from '@/utils/gameLink';
import { GameStatus, type Game, type Team } from '@types';
import { GameStatusBadge, TeamCrest } from '@/components/public';

type Side = 'win' | 'loss' | 'even';

/**
 * One fixture. A finished or running game shows its score where an upcoming one
 * shows "vs", so the column means the same thing down the whole list.
 *
 * Phones get a stacked card (one line per team, score on the right) because two
 * team names side by side do not fit 375px; wider screens keep the mirrored row
 * on a three-column grid so every score sits in the same place.
 */
export default function GameRow({ game }: { game: Game }) {
	const { t, i18n } = useTranslation();
	const played = game.status === GameStatus.COMPLETED || game.status === GameStatus.IN_PROGRESS;
	const time = formatGameTime(game.date, i18n.language);
	const home = game.homeScore ?? 0;
	const away = game.awayScore ?? 0;

	// Only a finished game has a loser to dim; a running one is still open.
	const decided = game.status === GameStatus.COMPLETED && home !== away;
	const homeSide: Side = decided ? (home > away ? 'win' : 'loss') : 'even';
	const awaySide: Side = decided ? (away > home ? 'win' : 'loss') : 'even';

	const league = game.season?.league?.name;
	const round = game.round != null ? t('public.games.round', { round: game.round }) : null;

	return (
		<Link
			to={gamePage(game) ?? `/season-detail/${game.seasonId}?tab=schedule`}
			className="block border-t border-border-subtle px-4 py-3.5 transition-colors first:border-t-0 hover:bg-muted/50 sm:px-5 sm:py-4"
		>
			{/* Phone: meta line, then one line per team. */}
			<div className="flex flex-col gap-2.5 sm:hidden">
				<div className="flex items-center gap-2 text-xs">
					<span className="font-bold tabular-nums">{time ?? t('public.games.noTime')}</span>
					{round && <span className="text-muted-foreground">· {round}</span>}
					{league && (
						<span className="flex min-w-0 items-center gap-1 text-muted-foreground">
							<span aria-hidden>·</span>
							<span className="truncate">{league}</span>
						</span>
					)}
					<span className="ml-auto shrink-0">
						<GameStatusBadge status={game.status} />
					</span>
				</div>
				<div className="flex flex-col gap-1.5">
					<TeamLine team={game.homeTeam} score={played ? home : null} side={homeSide} />
					<TeamLine team={game.awayTeam} score={played ? away : null} side={awaySide} />
				</div>
				{game.location && (
					<span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
						<MapPin className="size-3.5 shrink-0" />
						<span className="truncate">{game.location}</span>
					</span>
				)}
			</div>

			{/* Wider screens: time | home – score – away | meta. */}
			<div className="hidden items-center gap-5 sm:flex">
				<div className="w-24 shrink-0">
					<span className="text-[13px] font-bold tabular-nums">{time ?? t('public.games.noTime')}</span>
					{round && <div className="mt-0.5 text-xs text-muted-foreground">{round}</div>}
				</div>

				<div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
					<div className="flex min-w-0 items-center justify-end gap-2.5 text-right">
						<span className={`truncate text-sm ${nameTone(homeSide)}`}>{game.homeTeam?.name}</span>
						{game.homeTeam && <TeamCrest team={game.homeTeam} size={30} />}
					</div>
					<div className="min-w-16 text-center">
						{played ? (
							<span className="text-[17px] font-extrabold tabular-nums">
								{home} : {away}
							</span>
						) : (
							<span className="text-xs font-bold text-muted-foreground">{t('common.vs').toUpperCase()}</span>
						)}
					</div>
					<div className="flex min-w-0 items-center gap-2.5">
						{game.awayTeam && <TeamCrest team={game.awayTeam} size={30} />}
						<span className={`truncate text-sm ${nameTone(awaySide)}`}>{game.awayTeam?.name}</span>
					</div>
				</div>

				<div className="flex w-72 shrink-0 items-center justify-end gap-x-3">
					{/* The list spans every league, so each row says which one it belongs to. */}
					{league && (
						<span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
							<Trophy className="size-3.5 shrink-0" />
							<span className="truncate">{league}</span>
						</span>
					)}
					{game.location && (
						<span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
							<MapPin className="size-3.5 shrink-0" />
							<span className="truncate">{game.location}</span>
						</span>
					)}
					<span className="shrink-0">
						<GameStatusBadge status={game.status} />
					</span>
				</div>
			</div>
		</Link>
	);
}

function nameTone(side: Side): string {
	if (side === 'win') return 'font-bold';
	if (side === 'loss') return 'font-medium text-subtle-foreground';
	return 'font-semibold';
}

function TeamLine({ team, score, side }: { team?: Pick<Team, 'name' | 'logo' | 'primaryColor'> | null; score: number | null; side: Side }) {
	return (
		<div className="flex items-center gap-2.5">
			{team && <TeamCrest team={team} size={24} />}
			<span className={`min-w-0 flex-1 truncate text-[15px] ${nameTone(side)}`}>{team?.name}</span>
			{score != null && (
				<span className={`w-7 shrink-0 text-right text-base tabular-nums ${side === 'loss' ? 'font-semibold text-subtle-foreground' : 'font-extrabold'}`}>
					{score}
				</span>
			)}
		</div>
	);
}
