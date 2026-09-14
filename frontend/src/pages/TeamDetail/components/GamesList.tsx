import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDateShort, formatGameTime } from '@/utils/date';
import { GameStatus, type Game } from '@types';
import { EmptyState, Panel } from '@/components/public';

interface GamesListProps {
	games: Game[];
	teamId: string;
	seasonId?: string;
}

type Result = 'W' | 'D' | 'L';

/** How a finished game went for this team, from its own side of the score. */
export function resultOf(game: Game, teamId: string): Result {
	const home = game.homeTeamId === teamId;
	const own = (home ? game.homeScore : game.awayScore) ?? 0;
	const other = (home ? game.awayScore : game.homeScore) ?? 0;
	return own > other ? 'W' : own < other ? 'L' : 'D';
}

const RESULT_TONE: Record<Result, string> = {
	W: 'bg-success-soft text-success-strong',
	D: 'bg-muted text-subtle-foreground',
	L: 'bg-destructive-soft text-destructive-strong',
};

export default function GamesList({ games, teamId, seasonId }: GamesListProps) {
	const { t, i18n } = useTranslation();

	// Undated fixtures sort last in the API's list, so a completed game without a
	// date would otherwise be picked up as one of the "latest" five.
	const completed = games
		.filter((game) => game.status === GameStatus.COMPLETED && game.date)
		.sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
		.slice(0, 5);
	const upcoming = games.filter((game) => game.status === GameStatus.SCHEDULED).slice(0, 5);
	const rows = [...completed, ...upcoming];

	return (
		<Panel
			flush
			title={t('teamDetail.games.title')}
			action={
				seasonId && (
					<Link
						to={`/season-detail/${seasonId}?tab=schedule`}
						className="text-[13px] font-semibold text-primary hover:opacity-90"
					>
						{t('seasonDetail.overview.viewFullSchedule')}
					</Link>
				)
			}
		>
			{rows.length === 0 ? (
				<EmptyState title={t('teamDetail.games.none')} />
			) : (
				<div className="flex flex-col">
					{rows.map((game) => {
						const home = game.homeTeamId === teamId;
						const opponent = home ? game.awayTeam : game.homeTeam;
						const played = game.status === GameStatus.COMPLETED;
						const result = played ? resultOf(game, teamId) : null;

						return (
							<div
								key={game.id}
								className="flex items-center gap-4 border-b border-border-subtle px-5 py-3.5 last:border-0"
							>
								<div className="flex w-24 shrink-0 flex-col">
									<span className="text-[13px] font-bold">
										{game.date ? formatDateShort(game.date, i18n.language) : t('public.games.noTime')}
									</span>
									{game.date && !played && (
										<span className="text-xs text-muted-foreground">
											{formatGameTime(game.date, i18n.language)}
										</span>
									)}
								</div>

								<div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
									<span className="shrink-0 text-muted-foreground">
										{home ? t('teamDetail.games.home') : t('teamDetail.games.away')}
									</span>
									<span className="truncate font-semibold">{opponent?.name ?? '—'}</span>
								</div>

								{played ? (
									<div className="flex shrink-0 items-center gap-3">
										<span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${RESULT_TONE[result!]}`}>
											{t(`teamDetail.games.result.${result}`)}
										</span>
										<span className="w-14 text-right text-[15px] font-extrabold tabular-nums">
											{home ? game.homeScore ?? 0 : game.awayScore ?? 0} : {home ? game.awayScore ?? 0 : game.homeScore ?? 0}
										</span>
									</div>
								) : (
									<span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
										{game.round != null ? t('seasonDetail.schedule.round', { round: game.round }) : ''}
									</span>
								)}
							</div>
						);
					})}
				</div>
			)}
		</Panel>
	);
}
