import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { Inbox, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { registrationApi, seasonApi, teamApi, tournamentSeriesApi } from '@/services/api.ts';
import { PublicHero } from '@/components/public';
import { Role, type ManagedCompetition, type Season, type Team, type TournamentSeries } from '@types';

import MyTeamsSection from './components/MyTeamsSection';
import MyEventsSection from './components/MyEventsSection';
import MyPlayerTeamsSection from './components/MyPlayerTeamsSection';
import MyRegistrationsSection from './components/MyRegistrationsSection';
import EmailPreferenceCard from './components/EmailPreferenceCard';
import InstallAppCard from './components/InstallAppCard';
import WorkspacesSection from './components/WorkspacesSection';
import ManagedRegistrationsSection from './components/ManagedRegistrationsSection';
import OpenCompetitionsSection from './components/OpenCompetitionsSection';
import CreateCompetitionDialog, { type StartKind } from './components/CreateCompetitionDialog';
import { HelpCard, WhatsNewCard } from './components/SideCards';
import OnboardingTour from '@/components/OnboardingTour';

/**
 * Where a signed-in person lands: the areas they manage and what waits in
 * them, their own teams and events, and the competitions they could join.
 */
export default function HomeScreen() {
	const { t, i18n } = useTranslation();
	const { user, loading, isTeamManager } = useAuth();

	useDocumentTitle([t('public.nav.dashboard')]);

	const [seasons, setSeasons] = useState<Season[]>([]);
	const [series, setSeries] = useState<TournamentSeries[]>([]);
	const [myTeams, setMyTeams] = useState<Team[]>([]);
	const [managed, setManaged] = useState<ManagedCompetition[]>([]);
	const [listsLoading, setListsLoading] = useState(true);
	const [starting, setStarting] = useState<StartKind | null>(null);

	const manages = user?.manages;
	const runsCompetitions = (manages?.leagues ?? 0) + (manages?.series ?? 0) > 0;

	useEffect(() => {
		Promise.all([
			seasonApi.getAll().then((res) => setSeasons(res.data)),
			tournamentSeriesApi.getAll().then((res) => setSeries(res.data)),
		])
			.catch((err) => console.error(err))
			.finally(() => setListsLoading(false));
	}, []);

	useEffect(() => {
		if (!runsCompetitions) return;
		registrationApi.managed().then((res) => setManaged(res.data)).catch(() => setManaged([]));
	}, [runsCompetitions]);

	useEffect(() => {
		if (isTeamManager()) {
			teamApi.getMyTeams()
				.then((res) => setMyTeams(res.data))
				.catch((err) => console.error(err));
		}
	}, [user, isTeamManager]);

	if (!loading && !user) return <Navigate to="/" replace />;
	if (!user) return null;

	const hats = [
		user.role === Role.ADMIN && 'admin.roles.ADMIN',
		(manages?.leagues ?? 0) > 0 && 'hats.leagueManager',
		(manages?.teams ?? 0) > 0 && 'hats.teamManager',
		(manages?.series ?? 0) > 0 && 'hats.tournamentManager',
	].filter(Boolean) as string[];
	const pending = managed.reduce((sum, row) => sum + row.pending, 0);
	const firstWaiting = managed.find((row) => row.pending > 0);
	const today = new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });

	return (
		<>
			<div data-tour="dashboard-title">
				<PublicHero
					kicker={today}
					title={t('dashboard.hero.title', { name: user.name })}
					subtitle={hats.length > 0 ? t('dashboard.hero.managerText') : t('dashboard.hero.newText')}
					badge={hats.length > 0 && (
						<span className="flex flex-wrap gap-1.5">
							{hats.map((key) => (
								<span key={key} className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold text-white">{t(key)}</span>
							))}
						</span>
					)}
					actions={
						firstWaiting ? (
							<Link
								to={firstWaiting.inboxPath}
								className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-[15px] font-semibold text-brand-ink"
							>
								<Inbox className="size-4" aria-hidden />
								{t('dashboard.hero.pending', { count: pending })}
							</Link>
						) : hats.length === 0 ? (
							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									onClick={() => setStarting('league')}
									className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-[15px] font-semibold text-navy"
								>
									<Plus className="size-4" aria-hidden />
									{t('dashboard.start.league.title')}
								</button>
								<button
									type="button"
									onClick={() => setStarting('series')}
									className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 px-5 text-[15px] font-semibold text-white hover:bg-white/10"
								>
									{t('dashboard.start.series.title')}
								</button>
							</div>
						) : undefined
					}
				/>
			</div>

			<div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_340px]">
				<div className="flex min-w-0 flex-col gap-6">
					<WorkspacesSection managed={managed} onStart={setStarting} />
					<ManagedRegistrationsSection rows={managed} />
					{/* Each renders nothing for an account with nothing in it. */}
					<MyEventsSection />
					<MyPlayerTeamsSection />
					<MyRegistrationsSection />
					{isTeamManager() && myTeams.length > 0 && (
						<div data-tour="my-teams-section">
							<MyTeamsSection teams={myTeams} />
						</div>
					)}
					<OpenCompetitionsSection seasons={seasons} series={series} loading={listsLoading} />
				</div>

				<aside className="flex min-w-0 flex-col gap-4">
					<WhatsNewCard />
					<HelpCard />
					<InstallAppCard />
					<EmailPreferenceCard />
				</aside>
			</div>

			<CreateCompetitionDialog kind={starting} onClose={() => setStarting(null)} />
			{!listsLoading && <OnboardingTour />}
		</>
	);
}
