import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Game, GameStatus, Standing } from '@types';
import { Card, CardContent, CardTitle, CardHeader } from "@/components/base/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/base/table";

interface StandingsTableProps {
	standings: Standing[];
	games: Game[];
}

export default function StandingsTable({ standings, games }: StandingsTableProps) {
	const { t } = useTranslation();

	return (
		<div className="grid gap-6">
			<Card>
				<CardHeader>
					<CardTitle>{t('seasonDetail.standings.tableTitle', { count: games.filter(item => item.status == GameStatus.COMPLETED).length })}</CardTitle>
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
								.map((row, index) => (
									<TableRow
										key={row.team.id}
										style={{
											backgroundColor: `${row.team.primaryColor}08`,
											borderLeft: `4px solid ${row.team.primaryColor}`
										}}
									>
										<TableCell className="text-center">{index + 1}</TableCell>
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
										<TableCell className="text-center  font-bold">{row.points}</TableCell>
									</TableRow>
								))}
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
