import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { GameStatus, type Game } from '@types';
import { GAME_STATUS_TONE, SEASON_ACCENT, isPlayed, needsDate, roundsOf } from './util';

type Filter = 'noDate' | 'dated' | 'played';

interface GamesTabProps {
	games: Game[];
	onOpenDates: (round: number) => void;
	onOpenResult: (game: Game) => void;
}

export default function GamesTab({ games, onOpenDates, onOpenResult }: GamesTabProps) {
	const { t, i18n } = useTranslation();
	const [filter, setFilter] = useState<Filter>('noDate');
	const [round, setRound] = useState<number | null>(null);

	const buckets = useMemo(() => ({
		noDate: games.filter(needsDate),
		dated: games.filter((g) => g.date && !isPlayed(g)),
		played: games.filter(isPlayed),
	}), [games]);

	const rounds = useMemo(() => roundsOf(games), [games]);

	const visible = useMemo(() => {
		const list = buckets[filter];
		return round === null ? list : list.filter((g) => g.round === round);
	}, [buckets, filter, round]);

	const filters: { key: Filter; label: string }[] = [
		{ key: 'noDate', label: t('seasonManagement.games.filters.noDate', { count: buckets.noDate.length }) },
		{ key: 'dated', label: t('seasonManagement.games.filters.dated', { count: buckets.dated.length }) },
		{ key: 'played', label: t('seasonManagement.games.filters.played', { count: buckets.played.length }) },
	];

	const whenLabel = (game: Game) => {
		if (!game.date) return t('seasonManagement.games.noDate');
		const d = new Date(game.date);
		return `${d.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}`;
	};

	return (
		<div className="flex flex-col gap-3">
			{/* Which fixtures, by what is missing from them */}
			<div className="tm-segmented grid-cols-3">
				{filters.map((f) => (
					<button
						key={f.key}
						aria-pressed={filter === f.key}
						onClick={() => setFilter(f.key)}
					>
						{f.label}
					</button>
				))}
			</div>

			{/* Round filter */}
			{rounds.length > 1 && (
				<div className="tm-pill-strip">
					<button
						className="tm-sort-pill"
						aria-pressed={round === null}
						style={round === null ? { backgroundColor: SEASON_ACCENT } : undefined}
						onClick={() => setRound(null)}
					>
						{t('seasonManagement.games.allRounds')}
					</button>
					{rounds.map((r) => (
						<button
							key={r}
							className="tm-sort-pill"
							aria-pressed={round === r}
							style={round === r ? { backgroundColor: SEASON_ACCENT } : undefined}
							onClick={() => setRound(r)}
						>
							{t('seasonManagement.games.roundShort', { n: r })}
						</button>
					))}
				</div>
			)}

			{visible.length === 0 ? (
				<div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
					{t('seasonManagement.games.empty')}
				</div>
			) : (
				visible.map((game) => {
					const tone = GAME_STATUS_TONE[game.status];
					const scored = game.homeScore !== null && game.homeScore !== undefined;
					return (
						<div
							key={game.id}
							className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-sm"
						>
							<div className="flex items-center gap-2">
								<span
									className="tm-status-pill uppercase tracking-wide"
									style={{ backgroundColor: tone.bg, color: tone.fg }}
								>
									{t(`tm.status.${game.status}`)}
								</span>
								<span className="text-xs text-muted-foreground">
									{typeof game.round === 'number'
										? t('seasonManagement.games.round', { n: game.round })
										: t('seasonManagement.games.noRound')}
								</span>
							</div>

							{/* Both teams stacked, so neither name has to truncate against a score */}
							<div className="flex flex-col gap-1.5">
								{[
									{ team: game.homeTeam, score: game.homeScore },
									{ team: game.awayTeam, score: game.awayScore },
								].map((side, index) => (
									<div key={index} className="flex items-center gap-2.5">
										<span
											className="size-2 shrink-0 rounded-full"
											style={{ backgroundColor: side.team?.primaryColor || '#cbd5e1' }}
										/>
										<span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
											{side.team?.name}
										</span>
										<span className="shrink-0 text-[17px] font-bold tabular-nums">
											{scored ? side.score ?? 0 : '—'}
										</span>
									</div>
								))}
							</div>

							<div className="flex items-center gap-2 border-t border-border pt-2">
								<span
									className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px]"
									style={game.date ? undefined : { color: '#92400e' }}
								>
									<CalendarDays className="size-3 shrink-0" aria-hidden />
									<span className="truncate">{whenLabel(game)}</span>
								</span>
								{game.date ? (
									<button
										onClick={() => onOpenResult(game)}
										className="h-8 shrink-0 rounded-[9px] px-3 text-[13px] font-semibold text-white"
										style={{ backgroundColor: SEASON_ACCENT }}
									>
										{game.status === GameStatus.COMPLETED
											? t('seasonManagement.games.edit')
											: t('seasonManagement.games.result')}
									</button>
								) : (
									<button
										onClick={() => onOpenDates(game.round ?? 0)}
										className="h-8 shrink-0 rounded-[9px] border border-border px-3 text-[13px] font-semibold"
									>
										{t('seasonManagement.games.setDate')}
									</button>
								)}
							</div>
						</div>
					);
				})
			)}
		</div>
	);
}
