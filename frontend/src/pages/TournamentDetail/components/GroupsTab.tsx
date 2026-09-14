import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Grid3x3, List, Swords, Trophy, Users } from 'lucide-react';
import type { Tournament, TournamentStanding } from '@types';
import { EmptyState, FilterTabs, Panel } from '@/components/public';
import GroupMatrix from './GroupMatrix';
import GroupStandings from './GroupStandings';
import { groupTeams, isPlayed, qualifiedTeamIds, type SportContext } from './shared';

type GroupView = 'matrix' | 'table';

interface GroupsTabProps {
	tournament: Tournament;
	standings: Record<string, TournamentStanding[]>;
	context: SportContext;
}

// The matrix needs a column per entrant, which a phone cannot give it; a phone
// opens on the table and can still switch.
const initialView = (): GroupView =>
	typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches ? 'matrix' : 'table';

export default function GroupsTab({ tournament, standings, context }: GroupsTabProps) {
	const { t } = useTranslation();
	const groups = tournament.groups ?? [];
	const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
	const [view, setView] = useState<GroupView>(initialView);

	if (groups.length === 0) {
		return <EmptyState title={t('tournamentDetail.groups.empty')} />;
	}

	const group = groups.find((item) => item.id === groupId) ?? groups[0];
	const teams = groupTeams(tournament, group.id);
	const rows = standings[group.id] ?? [];
	const games = (tournament.games ?? []).filter((game) => game.phase === 'GROUP' && game.groupId === group.id);
	const played = games.filter(isPlayed).length;
	const qualified = qualifiedTeamIds(tournament.games ?? []);
	const leader = played > 0 ? rows[0] : undefined;
	const groupName = t('tournamentDetail.groups.groupLabel', { name: group.name });

	const tiles = [
		{
			icon: <Users className="size-[18px] text-primary" />,
			tone: 'bg-accent',
			value: teams.length,
			label: t('tournamentDetail.summary.entrants', { context }),
		},
		{
			icon: <Swords className="size-[18px] text-primary" />,
			tone: 'bg-accent',
			value: played,
			label: t('tournamentDetail.summary.played', { total: games.length }),
		},
		{
			icon: <Trophy className="size-[18px] text-warning-strong" />,
			tone: 'bg-warning-soft',
			value: leader ? `${leader.goalsFor}:${leader.goalsAgainst}` : '—',
			label: t('tournamentDetail.summary.leader', { context }),
			caption: leader?.team?.name,
		},
	];

	const summary = (stacked: boolean) => (
		<Panel title={t('tournamentDetail.summary.title')}>
			<div className={`grid gap-2.5 ${stacked ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
				{tiles.map((tile) => (
					<div
						key={tile.label}
						className={`flex gap-3 rounded-xl bg-background p-3.5 ${stacked ? 'items-center' : 'items-center sm:flex-col sm:items-start'}`}
					>
						<span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tile.tone}`}>{tile.icon}</span>
						<div className="flex min-w-0 flex-col gap-0.5">
							<span className="text-lg font-extrabold leading-tight tabular-nums">{tile.value}</span>
							<span className="text-xs text-muted-foreground">{tile.label}</span>
							{tile.caption && <span className="truncate text-[11px] font-bold tracking-wide">{tile.caption}</span>}
						</div>
					</div>
				))}
			</div>
		</Panel>
	);

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
				<FilterTabs
					tabs={groups.map((item) => ({ value: item.id, label: t('tournamentDetail.groups.groupLabel', { name: item.name }) }))}
					value={group.id}
					onChange={setGroupId}
				/>
				<FilterTabs
					className="lg:ml-auto"
					tabs={[
						{ value: 'matrix' as GroupView, label: t('tournamentDetail.groups.view.matrix'), icon: <Grid3x3 className="size-4" /> },
						{ value: 'table' as GroupView, label: t('tournamentDetail.groups.view.table'), icon: <List className="size-4" /> },
					]}
					value={view}
					onChange={setView}
				/>
			</div>

			{view === 'matrix' ? (
				<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
					<Panel flush title={groupName} description={t('tournamentDetail.groups.matrixHint', { context })}>
						<GroupMatrix teams={teams} games={games} teamLabel={t('tournamentDetail.standings.team', { context })} />
					</Panel>
					<div className="flex flex-col gap-5">
						{summary(false)}
						<Panel flush title={t('tournamentDetail.groups.standingsTitle')}>
							<GroupStandings standings={rows} qualified={qualified} context={context} variant="compact" />
						</Panel>
					</div>
				</div>
			) : (
				<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
					<Panel flush title={groupName} description={t('tournamentDetail.groups.standingsTitle')}>
						{/* A phone gets the sidebar's short table rather than a sideways scroll. */}
						<div className="hidden sm:block">
							<GroupStandings standings={rows} qualified={qualified} context={context} variant="full" />
						</div>
						<div className="sm:hidden">
							<GroupStandings standings={rows} qualified={qualified} context={context} variant="compact" />
						</div>
					</Panel>
					{summary(true)}
				</div>
			)}
		</div>
	);
}
