import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDateShort } from '@/utils/date';
import type { PlayerGameStatistic, SportType, StatKey } from '@types';
import { EmptyState, Panel, StatTile, Th, Td, TableShell, HeadRow } from '@/components/public';
import { profileFor, rankColumn } from '@/utils/sportProfiles';

interface PlayerStatisticsProps {
	statistics: PlayerGameStatistic[];
	/** The sport of the player's team: decides which numbers are shown. */
	sport?: SportType;
}

export default function PlayerStatistics({ statistics, sport }: PlayerStatisticsProps) {
	const { t, i18n } = useTranslation();
	const profile = profileFor(sport);
	const rank = rankColumn(profile);
	const columns: (StatKey | 'rankTotal')[] = rank.key === 'rankTotal' ? [...profile.stats, 'rankTotal'] : profile.stats;

	const lineValue = (stat: PlayerGameStatistic, key: StatKey | 'rankTotal'): number =>
		key === 'rankTotal'
			? profile.rankBy.reduce((sum, ranked) => sum + (stat[ranked] ?? 0), 0)
			: stat[key] ?? 0;
	const total = (key: StatKey | 'rankTotal') => statistics.reduce((sum, stat) => sum + lineValue(stat, key), 0);

	return (
		<div className="flex flex-col gap-5">
			<div className="grid gap-5 grid-cols-2 xl:grid-cols-5">
				<StatTile label={t('playerDetail.statistics.gamesPlayed')} value={statistics.length} />
				{columns.map((key) => (
					<StatTile key={key} label={t(`stats.long.${key}`)} value={total(key)} emphasis={key === rank.key} />
				))}
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
								{columns.map((key) => (
									<Th key={key} className={`text-center ${key === rank.key ? 'text-foreground' : ''}`}>
										{t(`stats.short.${key}`)}
									</Th>
								))}
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
									{columns.map((key) => (
										<Td key={key} className={`text-center ${key === rank.key ? 'font-extrabold' : ''}`}>
											{lineValue(stat, key)}
										</Td>
									))}
								</tr>
							))}
						</tbody>
					</TableShell>
				)}
			</Panel>
		</div>
	);
}
