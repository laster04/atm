import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDateShort } from '@/utils/date';
import type { HockeyGameStatistic } from '@types';
import { EmptyState, Panel, StatTile, Th, Td, TableShell, HeadRow } from '@/components/public';

interface PlayerStatisticsProps {
	statistics: HockeyGameStatistic[];
	totalGoals: number;
	totalAssists: number;
	totalPenaltyMinutes: number;
	gamesPlayed: number;
}

export default function PlayerStatistics({
	statistics,
	totalGoals,
	totalAssists,
	totalPenaltyMinutes,
	gamesPlayed,
}: PlayerStatisticsProps) {
	const { t, i18n } = useTranslation();

	return (
		<div className="flex flex-col gap-5">
			<div className="grid gap-5 grid-cols-2 xl:grid-cols-5">
				<StatTile label={t('playerDetail.statistics.gamesPlayed')} value={gamesPlayed} />
				<StatTile label={t('playerDetail.statistics.goals')} value={totalGoals} />
				<StatTile label={t('playerDetail.statistics.assists')} value={totalAssists} />
				<StatTile
					label={t('seasonDetail.playersStats.points')}
					value={totalGoals + totalAssists}
					emphasis
				/>
				<StatTile label={t('playerDetail.statistics.penaltyMinutes')} value={totalPenaltyMinutes} />
			</div>

			<Panel flush title={t('playerDetail.statistics.gameByGame')}>
				{statistics.length === 0 ? (
					<EmptyState title={t('playerDetail.statistics.noStatistics')} />
				) : (
					<TableShell minWidth={640}>
						<thead>
							<HeadRow>
								<Th className="text-left">{t('playerDetail.statistics.date')}</Th>
								<Th className="text-left">{t('playerDetail.statistics.game')}</Th>
								<Th className="text-center">{t('playerDetail.statistics.goals')}</Th>
								<Th className="text-center">{t('playerDetail.statistics.assists')}</Th>
								<Th className="text-center">{t('playerDetail.statistics.penaltyMinutesShort')}</Th>
								<Th className="text-center text-foreground">{t('seasonDetail.playersStats.points')}</Th>
							</HeadRow>
						</thead>
						<tbody>
							{statistics.map((stat) => (
								<tr key={stat.id} className="border-t border-border-subtle transition-colors hover:bg-muted/50">
									<Td className="text-left text-muted-foreground">
										{stat.game?.date ? formatDateShort(stat.game.date, i18n.language) : '—'}
									</Td>
									<Td className="text-left">
										{stat.game?.seasonId ? (
											<Link
												to={`/season-detail/${stat.game.seasonId}?tab=schedule`}
												className="font-medium hover:text-primary"
											>
												{stat.game?.homeTeam?.name} – {stat.game?.awayTeam?.name}
											</Link>
										) : (
											<span className="font-medium">
												{stat.game?.homeTeam?.name} – {stat.game?.awayTeam?.name}
											</span>
										)}
									</Td>
									<Td className="text-center">{stat.goals ?? 0}</Td>
									<Td className="text-center">{stat.assists ?? 0}</Td>
									<Td className="text-center">{stat.penaltyMinutes ?? 0}</Td>
									<Td className="text-center font-extrabold">{(stat.goals ?? 0) + (stat.assists ?? 0)}</Td>
								</tr>
							))}
						</tbody>
					</TableShell>
				)}
			</Panel>
		</div>
	);
}
