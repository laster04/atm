import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Radio } from 'lucide-react';
import { Game, GameStatus, GroupTable, SportType } from '@types';
import { hasLiveGames, liveTone } from '@/utils/liveTable';
import { volleyballSplit } from '@/utils/volleyballTable';
import { EmptyState, Panel, TeamCrest, Th, Td, TableShell, HeadRow } from '@/components/public';

interface StandingsTableProps {
	/** One entry per division; a season with none arrives as a single table. */
	tables: GroupTable[];
	games: Game[];
	/** Volleyball gets its own columns: the 3:2 split, sets and balls. */
	sport?: SportType;
	/** An archived season has no games left, only its frozen table. */
	archived?: boolean;
}

export default function StandingsTable({ tables, games, sport, archived }: StandingsTableProps) {
	const { t } = useTranslation();
	const volleyball = sport === SportType.VOLLEYBALL;
	const standings = tables.flatMap((table) => table.standings);
	const live = hasLiveGames(standings);
	// The table is the regular season; play-off games are counted on the bracket.
	// An archived season's games are gone, so the count comes from the frozen
	// table instead: every game added one "played" to each of its two teams.
	const played = archived
		? Math.round(standings.reduce((sum, row) => sum + row.played, 0) / 2)
		: games.filter((game) => game.status === GameStatus.COMPLETED && !game.playoffSeriesId).length;
	// A single unnamed table is an undivided season and needs no heading.
	const divided = tables.length > 1 || tables.some((table) => table.group !== null);

	if (standings.length === 0) {
		return <EmptyState title={t('seasonDetail.standings.noData')} />;
	}

	return (
		<Panel
			flush
			title={t('seasonDetail.standings.tableTitle', { count: played })}
			description={
				live ? (
					<span className="flex items-center gap-2">
						<Radio className="size-3.5 shrink-0 animate-pulse text-destructive-strong" aria-hidden />
						{t('seasonDetail.standings.liveHint')}
					</span>
				) : undefined
			}
		>
			<TableShell minWidth={760}>
				<thead>
					<HeadRow>
						<Th className="w-14 text-center">{t('seasonDetail.standings.rank')}</Th>
						<Th className="text-left">{t('seasonDetail.standings.team')}</Th>
						<Th className="text-center">{t('seasonDetail.standings.played')}</Th>
						{volleyball ? (
							<>
								{(['v3', 'v2', 'p1', 'p0'] as const).map((key) => (
									<Th key={key} className="text-center">
										<abbr title={t(`seasonDetail.standings.volleyball.${key}Title`)} className="no-underline">
											{t(`seasonDetail.standings.volleyball.${key}`)}
										</abbr>
									</Th>
								))}
								<Th className="text-center">
									<abbr title={t('seasonDetail.standings.volleyball.setsTitle')} className="no-underline">
										{t('seasonDetail.standings.volleyball.sets')}
									</abbr>
								</Th>
								<Th className="text-center">
									<abbr title={t('seasonDetail.standings.volleyball.ballsTitle')} className="no-underline">
										{t('seasonDetail.standings.volleyball.balls')}
									</abbr>
								</Th>
							</>
						) : (
							<>
								<Th className="text-center">{t('seasonDetail.standings.wins')}</Th>
								<Th className="text-center">{t('seasonDetail.standings.draws')}</Th>
								<Th className="text-center">{t('seasonDetail.standings.losses')}</Th>
								<Th className="text-center">{t('seasonDetail.standings.goalsFor')}</Th>
								<Th className="text-center">{t('seasonDetail.standings.goalsAgainst')}</Th>
								<Th className="text-center">{t('seasonDetail.standings.goalDifference')}</Th>
							</>
						)}
						<Th className="text-center text-foreground">{t('seasonDetail.standings.points')}</Th>
					</HeadRow>
				</thead>
				<tbody>
					{/* Rows stay in their official order. A game in progress is shown as
					    the move it would cause, never by reordering the table. */}
					{tables.flatMap((table) => [
						...(divided
							? [
									<tr key={`head-${table.group?.id ?? 'unplaced'}`} className="border-t border-border-subtle">
										<Td colSpan={volleyball ? 9 : 10} className="bg-muted/60 text-[11px] font-bold uppercase tracking-wide">
											{table.group?.name ?? t('seasonDetail.standings.unplaced')}
										</Td>
									</tr>,
								]
							: []),
						...table.standings.map((row) => {
							const tone = liveTone(row);
							const color = row.team.primaryColor;
							return (
								<tr
									key={row.team.id}
									className="border-t border-border-subtle transition-colors hover:bg-muted/50"
									style={{
										backgroundColor: tone.background ?? (color ? `${color}0a` : undefined),
										boxShadow: color ? `inset 4px 0 0 ${color}` : undefined,
									}}
								>
									<Td className="text-center">
										<span className="inline-flex items-center gap-1 font-bold">
											{row.rank}
											{tone.direction !== 0 && (
												<span
													className={`inline-flex items-center text-[10px] font-bold tabular-nums ${
														tone.direction === 1 ? 'text-success-strong' : 'text-destructive-strong'
													}`}
													title={t(
														tone.direction === 1
															? 'seasonDetail.standings.wouldClimb'
															: 'seasonDetail.standings.wouldDrop',
														{ places: tone.places, rank: row.live?.rank }
													)}
												>
													{tone.direction === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
													{tone.places}
												</span>
											)}
										</span>
									</Td>
									<Td className="text-left">
										<div className="flex items-center gap-2.5">
											<TeamCrest team={row.team} size={26} />
											<Link to={`/teams/${row.team.id}`} className="font-semibold hover:text-primary">
												{row.team.name}
											</Link>
											{tone.inPlay && (
												<span
													className="rounded-full bg-destructive-strong px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
													title={t('seasonDetail.standings.playingNow')}
												>
													{t('seasonDetail.standings.liveTag')}
												</span>
											)}
											{!tone.inPlay && tone.awaiting && (
												<span
													className="rounded-full bg-warning px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-warning-foreground"
													title={t('seasonDetail.standings.awaitingConfirmation')}
												>
													{t('seasonDetail.standings.pendingTag')}
												</span>
											)}
										</div>
									</Td>
									<Td className="text-center">{row.played}</Td>
									{volleyball ? (
										<>
											{Object.values(volleyballSplit(row)).map((count, index) => (
												<Td key={index} className="text-center">{count}</Td>
											))}
											<Td className="text-center tabular-nums">{row.goalsFor}:{row.goalsAgainst}</Td>
											<Td className="text-center tabular-nums">{row.partPointsFor}:{row.partPointsAgainst}</Td>
										</>
									) : (
										<>
											<Td className="text-center">{row.wins}</Td>
											<Td className="text-center">{row.draws}</Td>
											<Td className="text-center">{row.losses}</Td>
											<Td className="text-center">{row.goalsFor}</Td>
											<Td className="text-center">{row.goalsAgainst}</Td>
											<Td className="text-center">
												<span
													className={`font-semibold ${
														row.goalDifference > 0 ? 'text-success-strong' : row.goalDifference < 0 ? 'text-destructive-strong' : ''
													}`}
												>
													{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
												</span>
											</Td>
										</>
									)}
									<Td className="text-center text-[15px] font-extrabold">
										{row.points}
										{row.live && row.live.points !== row.points && (
											<span className="ml-1 text-[11px] font-semibold text-muted-foreground">→ {row.live.points}</span>
										)}
									</Td>
								</tr>
							);
						}),
					])}
				</tbody>
			</TableShell>
		</Panel>
	);
}
