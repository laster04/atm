import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TopScorer } from '@types';
import { EmptyState, Panel, TeamCrest, Th, Td, TableShell, HeadRow, TeamRow } from '@/components/public';

/** Gold, silver, bronze for the first three; the rest take the quiet chip. */
const MEDALS = ['bg-brand text-brand-ink', 'bg-border text-subtle-foreground', 'bg-warning-soft text-warning-strong'];

export default function PlayersStatsTable({ topScorers }: { topScorers: TopScorer[] }) {
	const { t } = useTranslation();

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
						<Th className="text-center">{t('seasonDetail.playersStats.goals')}</Th>
						<Th className="text-center">{t('seasonDetail.playersStats.assists')}</Th>
						<Th className="text-center">{t('seasonDetail.playersStats.penaltyMinutes')}</Th>
						<Th className="text-center text-foreground">{t('seasonDetail.playersStats.points')}</Th>
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
							<Td className="text-center">{scorer.goals}</Td>
							<Td className="text-center">{scorer.assists}</Td>
							<Td className="text-center">{scorer.penaltyMinutes ?? 0}</Td>
							<Td className="text-center text-[15px] font-extrabold">{scorer.points}</Td>
						</TeamRow>
					))}
				</tbody>
			</TableShell>
		</Panel>
	);
}
