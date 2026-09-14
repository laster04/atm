import { useTranslation } from 'react-i18next';
import type { TournamentStanding } from '@types';
import { Td, Th, TableShell, HeadRow } from '@/components/public';
import { RankMark, record, type SportContext } from './shared';

interface GroupStandingsProps {
	standings: TournamentStanding[];
	/** Teams that went through to the playoff; empty until the bracket exists. */
	qualified: Set<string>;
	context: SportContext;
	/** The sidebar table carries a record column; the full one splits it out. */
	variant: 'compact' | 'full';
}

export default function GroupStandings({ standings, qualified, context, variant }: GroupStandingsProps) {
	const { t } = useTranslation();
	const withDraws = standings.some((row) => row.drawn > 0);
	const anyQualified = standings.some((row) => qualified.has(row.teamId));
	// Before a ball is hit every row is level; medals would rank a tie.
	const ranked = standings.some((row) => row.played > 0);

	return (
		<>
			<TableShell minWidth={variant === 'full' ? 640 : 320}>
				<thead>
					<HeadRow>
						<Th className="w-12 text-center">{t('tournamentDetail.standings.rank')}</Th>
						<Th className="text-left">{t('tournamentDetail.standings.team', { context })}</Th>
						{variant === 'compact' ? (
							<Th className="text-center">{t('tournamentDetail.standings.record', { context: withDraws ? 'DRAWS' : undefined })}</Th>
						) : (
							<>
								<Th className="text-center">{t('tournamentDetail.standings.played')}</Th>
								<Th className="text-center">{t('tournamentDetail.standings.won')}</Th>
								{withDraws && <Th className="text-center">{t('tournamentDetail.standings.drawn')}</Th>}
								<Th className="text-center">{t('tournamentDetail.standings.lost')}</Th>
							</>
						)}
						<Th className="text-center">{t('tournamentDetail.standings.score', { context })}</Th>
						{variant === 'full' && <Th className="text-center">{t('tournamentDetail.standings.goalDiff')}</Th>}
						<Th className="text-center text-foreground">{t('tournamentDetail.standings.points')}</Th>
					</HeadRow>
				</thead>
				<tbody>
					{standings.map((row, index) => (
						<tr
							key={row.teamId}
							className="border-t border-border-subtle"
							style={qualified.has(row.teamId) ? { boxShadow: 'inset 4px 0 0 rgb(var(--primary))' } : undefined}
						>
							<Td className="text-center">
								{ranked ? <RankMark rank={index + 1} /> : <span className="text-muted-foreground">{index + 1}</span>}
							</Td>
							<Td className="whitespace-nowrap text-left font-bold">{row.team?.name}</Td>
							{variant === 'compact' ? (
								<Td className="text-center tabular-nums">{record(row, withDraws)}</Td>
							) : (
								<>
									<Td className="text-center">{row.played}</Td>
									<Td className="text-center">{row.won}</Td>
									{withDraws && <Td className="text-center">{row.drawn}</Td>}
									<Td className="text-center">{row.lost}</Td>
								</>
							)}
							<Td className={`text-center tabular-nums ${variant === 'compact' ? 'text-subtle-foreground' : ''}`}>
								{row.goalsFor}:{row.goalsAgainst}
							</Td>
							{variant === 'full' && (
								<Td className="text-center">
									<span
										className={`font-semibold ${
											row.goalDiff > 0 ? 'text-success-strong' : row.goalDiff < 0 ? 'text-destructive-strong' : ''
										}`}
									>
										{row.goalDiff > 0 ? '+' : ''}
										{row.goalDiff}
									</span>
								</Td>
							)}
							<Td className="text-center text-[15px] font-extrabold">{row.points}</Td>
						</tr>
					))}
				</tbody>
			</TableShell>
			{anyQualified && (
				<div className="flex items-center gap-2 border-t border-border-subtle px-5 py-3 text-xs text-muted-foreground">
					<span className="h-3.5 w-1 rounded-sm bg-primary" aria-hidden />
					{t('tournamentDetail.groups.qualified')}
				</div>
			)}
		</>
	);
}
