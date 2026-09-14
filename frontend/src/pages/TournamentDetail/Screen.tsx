import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, LayoutGrid, MapPin, Trophy, Users } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tournamentApi } from '@/services/api';
import type { Tournament, TournamentStanding } from '@types';
import { PublicHero, SectionTabs, VisibilityBadge, type SectionTab } from '@/components/public';
import { formatSeasonDate } from '@/utils/date';
import GroupsTab from './components/GroupsTab';
import ScheduleTab from './components/ScheduleTab';
import PlayoffBracket from './components/PlayoffBracket';
import TeamsTab from './components/TeamsTab';
import { seedLabels, sportContext } from './components/shared';

type TournamentTab = 'groups' | 'schedule' | 'playoff' | 'teams';

const STATUS_TONE: Record<string, string> = {
	DRAFT: 'bg-muted text-subtle-foreground',
	REGISTRATION: 'bg-accent text-accent-foreground',
	GROUP_STAGE: 'bg-success-soft text-success-strong',
	PLAYOFF: 'bg-success-soft text-success-strong',
	COMPLETED: 'bg-success-soft text-success-strong',
};

export default function TournamentDetailScreen() {
	const { t, i18n } = useTranslation();
	const { id } = useParams<{ id: string }>();
	const [searchParams, setSearchParams] = useSearchParams();
	const [tournament, setTournament] = useState<Tournament | null>(null);
	const [standings, setStandings] = useState<Record<string, TournamentStanding[]>>({});
	const [loading, setLoading] = useState(true);
	const context = sportContext(tournament);

	useDocumentTitle([tournament?.name, tournament?.series?.name]);

	useEffect(() => {
		if (!id) return;
		setLoading(true);
		tournamentApi
			.getById(id)
			.then(async (res) => {
				const loaded = res.data;
				setTournament(loaded);
				const byGroup: Record<string, TournamentStanding[]> = {};
				await Promise.all(
					(loaded.groups ?? []).map(async (group) => {
						byGroup[group.id] = (await tournamentApi.getStandings(id, group.id)).data;
					})
				);
				setStandings(byGroup);
			})
			.catch((error) => console.error(error))
			.finally(() => setLoading(false));
	}, [id]);

	if (loading && !tournament) {
		return (
			<div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
				{t('tournamentDetail.loading')}
			</div>
		);
	}

	if (!tournament) {
		return (
			<div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
				{t('tournamentDetail.notFound')}
			</div>
		);
	}

	const tabs: SectionTab<TournamentTab>[] = [
		{ value: 'groups', label: t('tournamentDetail.tabs.groups'), icon: <LayoutGrid className="size-4" /> },
		{ value: 'schedule', label: t('tournamentDetail.tabs.schedule'), icon: <CalendarDays className="size-4" /> },
		{ value: 'playoff', label: t('tournamentDetail.tabs.playoff'), icon: <Trophy className="size-4" /> },
		{ value: 'teams', label: t('tournamentDetail.tabs.teams', { context }), icon: <Users className="size-4" /> },
	];
	const requested = searchParams.get('tab');
	const activeTab = tabs.find((tab) => tab.value === requested)?.value ?? 'groups';
	const setActiveTab = (tab: TournamentTab) => setSearchParams({ tab }, { replace: true });

	const series = tournament.series;
	const start = formatSeasonDate(tournament.startDate, i18n.language);
	const end = formatSeasonDate(tournament.endDate, i18n.language);
	const entrants = tournament.teams?.length ?? 0;
	const gameCount = tournament.games?.length ?? 0;

	return (
		<>
			<PublicHero
				title={tournament.name}
				kicker={series?.name}
				sport={series?.sportType}
				crumbs={[
					{ label: t('public.nav.home'), to: '/' },
					{ label: t('public.nav.tournaments'), to: '/tournaments' },
					...(series ? [{ label: series.name, to: `/tournaments/${series.id}` }] : []),
					{ label: tournament.name },
				]}
				badge={
					<>
						{series && (
							<span className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand">
								{t(`sports.${series.sportType}`)}
							</span>
						)}
						<span
							className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
								STATUS_TONE[tournament.status] ?? STATUS_TONE.DRAFT
							}`}
						>
							{t(`tm.tournamentStatus.${tournament.status}`, tournament.status)}
						</span>
						<VisibilityBadge visibility={series?.visibility} />
					</>
				}
				meta={
					<>
						{start && (
							<span className="flex items-center gap-2">
								<CalendarDays className="size-4 text-brand" />
								{end && end !== start ? `${start} – ${end}` : start}
							</span>
						)}
						{tournament.location && (
							<span className="flex items-center gap-2">
								<MapPin className="size-4 text-brand" />
								{tournament.location}
							</span>
						)}
						<span className="flex items-center gap-2">
							<Users className="size-4 text-brand" />
							{context
								? t('public.players.count', { count: entrants })
								: t('public.teams.count', { count: entrants })}
						</span>
						<span className="flex items-center gap-2">
							<Trophy className="size-4 text-brand" />
							{t('public.games.count', { count: gameCount })}
						</span>
					</>
				}
			/>

			<SectionTabs tabs={tabs} value={activeTab} onChange={setActiveTab} />

			<div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-7 sm:px-8">
				{activeTab === 'groups' && <GroupsTab tournament={tournament} standings={standings} context={context} />}
				{activeTab === 'schedule' && <ScheduleTab tournament={tournament} />}
				{activeTab === 'playoff' && (
					<PlayoffBracket games={tournament.games ?? []} seeds={seedLabels(tournament, standings)} />
				)}
				{activeTab === 'teams' && <TeamsTab tournament={tournament} standings={standings} context={context} />}
			</div>
		</>
	);
}
