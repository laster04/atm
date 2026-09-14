import { useTranslation } from 'react-i18next';
import type { Tournament, TournamentStanding, TournamentTeam } from '@types';
import { EmptyState, Panel, TeamCrest } from '@/components/public';
import { qualifiedTeamIds, record, type SportContext } from './shared';

interface TeamsTabProps {
	tournament: Tournament;
	standings: Record<string, TournamentStanding[]>;
	context: SportContext;
}

/** Everyone entered, a card per group in table order; a tournament without groups gets one card. */
export default function TeamsTab({ tournament, standings, context }: TeamsTabProps) {
	const { t } = useTranslation();
	const teams = tournament.teams ?? [];
	const qualified = qualifiedTeamIds(tournament.games ?? []);

	if (teams.length === 0) {
		return <EmptyState title={t('tournamentDetail.teams.empty', { context })} />;
	}

	const grouped = new Set<string>();
	const cards: { key: string; title: string; entries: { team: TournamentTeam; row?: TournamentStanding }[] }[] = [];

	for (const group of tournament.groups ?? []) {
		const rows = standings[group.id] ?? [];
		const members = (group.teams ?? []).map((entry) => entry.team);
		members.forEach((team) => grouped.add(team.id));
		// Table order when there is a table, entry order otherwise.
		const ordered = rows.length > 0
			? rows.map((row) => ({ team: members.find((team) => team.id === row.teamId) ?? (row.team as TournamentTeam), row }))
			: members.map((team) => ({ team }));
		cards.push({ key: group.id, title: t('tournamentDetail.groups.groupLabel', { name: group.name }), entries: ordered });
	}

	const rest = teams.filter((team) => !grouped.has(team.id));
	if (rest.length > 0) {
		cards.push({
			key: 'ungrouped',
			title: cards.length > 0 ? t('tournamentDetail.teams.ungrouped') : t('tournamentDetail.tabs.teams', { context }),
			entries: rest.map((team) => ({ team })),
		});
	}

	return (
		<div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-4">
			{cards.map((card) => (
				<Panel
					key={card.key}
					flush
					title={card.title}
					description={
						context
							? t('public.players.count', { count: card.entries.length })
							: t('public.teams.count', { count: card.entries.length })
					}
				>
					{card.entries.map(({ team, row }, index) => (
						<div
							key={team.id}
							className={`flex items-center gap-3 px-5 py-2.5 ${index === 0 ? '' : 'border-t border-border-subtle'}`}
							style={qualified.has(team.id) ? { boxShadow: 'inset 4px 0 0 rgb(var(--primary))' } : undefined}
						>
							{row && <span className="w-4 shrink-0 text-xs font-bold text-muted-foreground">{index + 1}</span>}
							<TeamCrest team={{ name: team.name, logo: team.logo ?? null, primaryColor: team.primaryColor ?? null }} size={32} />
							<div className="flex min-w-0 flex-1 flex-col">
								<span className="truncate text-[13px] font-bold">{team.name}</span>
								{team.country && <span className="truncate text-xs text-muted-foreground">{team.country}</span>}
							</div>
							{row && row.played > 0 && (
								<span className="text-[13px] tabular-nums text-subtle-foreground">{record(row, row.drawn > 0)}</span>
							)}
						</div>
					))}
				</Panel>
			))}
		</div>
	);
}
