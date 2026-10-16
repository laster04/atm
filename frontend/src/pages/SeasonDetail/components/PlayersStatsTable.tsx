import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TopScorer, type SportType } from '@types';
import { profileFor, rankColumn } from '@/utils/sportProfiles';
import { EmptyState, Panel, TeamCrest, Th, Td, TableShell, HeadRow, TeamRow } from '@/components/public';

/** Gold, silver, bronze for the first three; the rest take the quiet chip. */
const MEDALS = ['bg-brand text-brand-ink', 'bg-border text-subtle-foreground', 'bg-warning-soft text-warning-strong'];

export default function PlayersStatsTable({ topScorers, sport }: { topScorers: TopScorer[]; sport?: SportType }) {
	const { t } = useTranslation();
	const profile = profileFor(sport);
	const rank = rankColumn(profile);
	// The ranked number is bold; hockey adds a points column of its own for it.
	const columns = rank.key === 'rankTotal' ? [...profile.stats, 'rankTotal' as const] : profile.stats;

	if (profile.stats.length === 0) {
		return <EmptyState title={t('stats.none')} />;
	}

	if (topScorers.length === 0) {
		return <EmptyState title={t('seasonDetail.playersStats.noStats')} />;
	}

	return (
		<Panel flush title={t('seasonDetail.playersStats.title')}>
			<TableShell minWidth={720}>
				<thead>
					<HeadRow>
						<Th className="w-14 text-center">{t('seasonDetail.playersStats.rank')}</Th>
						<Th className="text-left">{t('seasonDetail.playersStats.player')}</Th>
						<Th className="text-left">{t('seasonDetail.playersStats.team')}</Th>
						<Th className="text-center">{t('seasonDetail.playersStats.gamesPlayed')}</Th>
						{columns.map((key) => (
							<Th key={key} className={`text-center ${key === rank.key ? 'text-foreground' : ''}`}>
								{t(`stats.short.${key}`)}
							</Th>
						))}
					</HeadRow>
				</thead>
				<tbody>
					{topScorers.map((scorer, index) => (
						<TeamRow key={scorer.player.id} color={scorer.player.team?.primaryColor}>
							<Td className="text-center">
								<span
									className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-extrabold ${
										MEDALS[index] ?? ''
									}`}
								>
									{index + 1}
								</span>
							</Td>
							<Td className="text-left">
								<Link to={`/players/${scorer.player.id}`} className="font-semibold hover:text-primary">
									{scorer.player.name}
								</Link>
								{scorer.player.number != null && (
									<span className="ml-2 text-xs text-muted-foreground">#{scorer.player.number}</span>
								)}
							</Td>
							<Td className="text-left">
								{scorer.player.team && (
									<Link
										to={`/teams/${scorer.player.team.id}`}
										className="flex items-center gap-2.5 text-subtle-foreground hover:text-foreground"
									>
										<TeamCrest team={scorer.player.team} size={24} />
										<span className="truncate">{scorer.player.team.name}</span>
									</Link>
								)}
							</Td>
							<Td className="text-center">{scorer.gamesPlayed}</Td>
							{columns.map((key) => (
								<Td key={key} className={`text-center ${key === rank.key ? 'text-[15px] font-extrabold' : ''}`}>
									{scorer[key] ?? 0}
								</Td>
							))}
						</TeamRow>
					))}
				</tbody>
			</TableShell>
		</Panel>
	);
}
