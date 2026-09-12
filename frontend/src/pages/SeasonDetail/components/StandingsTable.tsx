import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Radio } from 'lucide-react';
import { Game, GameStatus, Standing } from '@types';
import { hasLiveGames, liveTone } from '@/utils/liveTable';
import { Card, CardContent, CardTitle, CardHeader } from "@/components/base/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/base/table";

interface StandingsTableProps {
	standings: Standing[];
	games: Game[];
}

export default function StandingsTable({ standings, games }: StandingsTableProps) {
	const { t } = useTranslation();
	const live = hasLiveGames(standings);

	return (
		<div className="gap-6">
			<Card>
				<CardHeader>
					<CardTitle>{t('seasonDetail.standings.tableTitle', { count: games.filter(item => item.status == GameStatus.COMPLETED).length })}</CardTitle>
					{/* The rows stay in their official order. A game being played is
					    shown as the move it would cause, not by reordering the table. */}
					{live && (
						<div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
							<Radio className="size-3.5 shrink-0 animate-pulse text-red-600" aria-hidden />
							<span>{t('seasonDetail.standings.liveHint')}</span>
						</div>
					)}
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="text-center">{t('seasonDetail.standings.rank')}</TableHead>
								<TableHead> {t('seasonDetail.standings.team')}</TableHead>
								<TableHead className="text-center">{t('seasonDetail.standings.played')}</TableHead>
								<TableHead className="text-center">{t('seasonDetail.standings.wins')}</TableHead>
								<TableHead className="text-center">{t('seasonDetail.standings.draws')}</TableHead>
								<TableHead className="text-center">{t('seasonDetail.standings.losses')}</TableHead>
								<TableHead
									className="text-center">{t('seasonDetail.standings.goalsFor')}</TableHead>
								<TableHead
									className="text-center">{t('seasonDetail.standings.goalsAgainst')}</TableHead>
								<TableHead
									className="text-center">{t('seasonDetail.standings.goalDifference')}</TableHead>
								<TableHead className="text-center">{t('seasonDetail.standings.points')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{standings
								.map((row) => {
									const tone = liveTone(row);
									return (
									<TableRow
										key={row.team.id}
										style={{
											// A tinted live row replaces the team tint rather than
											// stacking on it, or neither colour would read.
											backgroundColor: tone.background ?? `${row.team.primaryColor}08`,
											borderLeft: `4px solid ${row.team.primaryColor}`
										}}
									>
										<TableCell className="text-center">
											<span className="inline-flex items-center gap-1">
												{row.rank}
												{tone.direction !== 0 && (
													<span
														className="inline-flex items-center text-[10px] font-bold tabular-nums"
														style={{ color: tone.direction === 1 ? '#166534' : '#991b1b' }}
														title={t(
															tone.direction === 1
																? 'seasonDetail.standings.wouldClimb'
																: 'seasonDetail.standings.wouldDrop',
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
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-3">
												<div
													className="size-3 rounded-full flex-shrink-0"
													style={{ backgroundColor: row.team.primaryColor ?? undefined }}
												/>
												<Link to={`/teams/${row.team.id}`}
													  className="font-medium hover:text-gray-400">
													{row.team.name}
												</Link>
												{tone.inPlay && (
													<span
														className="rounded-full bg-red-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
														title={t('seasonDetail.standings.playingNow')}
													>
														{t('seasonDetail.standings.liveTag')}
													</span>
												)}
											</div>
										</TableCell>
										<TableCell className="text-center"> {row.played}</TableCell>
										<TableCell className="text-center">{row.wins}</TableCell>
										<TableCell className="text-center">{row.draws}</TableCell>
										<TableCell className="text-center">{row.losses}</TableCell>
										<TableCell className="text-center font-medium">{row.goalsFor}</TableCell>
										<TableCell className="text-center">{row.goalsAgainst}</TableCell>
										<TableCell className="text-center">
                      <span
						  className={
							  row.goalDifference > 0
								  ? 'text-green-600'
								  : 'text-red-600'
						  }
					  >
                        {row.goalDifference > 0 ? '+' : ''}
						  {row.goalDifference}
                      </span>
										</TableCell>
										<TableCell className="text-center font-bold">
											{row.points}
											{row.live && row.live.points !== row.points && (
												<span className="ml-1 text-[11px] font-semibold text-muted-foreground">
													→ {row.live.points}
												</span>
											)}
										</TableCell>
									</TableRow>
									);
								})}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
			{standings.length === 0 && (
				<div className="p-8 text-center text-gray-500">{t('seasonDetail.standings.noData')}</div>
			)}
		</div>
	);
}
