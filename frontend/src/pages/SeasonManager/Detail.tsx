import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarDays, MoreHorizontal, Table2, Trophy, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { gameApi, seasonApi, teamApi } from '@/services/api';
import { Button } from '@components/base/button';
import type { Game, Season, Standing, Team } from '@types';
import OverviewTab from './components/OverviewTab';
import GamesTab from './components/GamesTab';
import TeamsTab from './components/TeamsTab';
import StandingsTab from './components/StandingsTab';
import MoreTab from './components/MoreTab';
import RoundDatesSheet from './components/RoundDatesSheet';
import ResultSheet from './components/ResultSheet';
import { SEASON_ACCENT, SEASON_STATUS_TONE, isPlayed, needsDate, teamCount } from './components/util';

export type SeasonTab = 'overview' | 'games' | 'teams' | 'table' | 'more';

export default function Detail() {
	const { id } = useParams<{ id: string }>();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { isAdmin } = useAuth();

	const [activeTab, setActiveTab] = useState<SeasonTab>('overview');
	const [season, setSeason] = useState<Season | null>(null);
	const [teams, setTeams] = useState<Team[]>([]);
	const [games, setGames] = useState<Game[]>([]);
	const [standings, setStandings] = useState<Standing[]>([]);
	const [loading, setLoading] = useState(false);

	/** Round whose dates are being edited, or null when the sheet is closed. */
	const [datesRound, setDatesRound] = useState<number | null>(null);
	/** Fixture whose result is being recorded, or null when the sheet is closed. */
	const [resultGame, setResultGame] = useState<Game | null>(null);

	useEffect(() => {
		if (!id) return;
		setLoading(true);
		Promise.all([
			seasonApi.getById(id),
			teamApi.getBySeason(id),
			gameApi.getBySeason(id),
		])
			.then(([seasonRes, teamsRes, gamesRes]) => {
				setSeason(seasonRes.data);
				setTeams(teamsRes.data);
				setGames(gamesRes.data);
			})
			.catch((err) => console.error(err))
			.finally(() => setLoading(false));
	}, [id]);

	// Standings only mean something once a game has been played, and the endpoint
	// is the one call the other three tabs never need.
	useEffect(() => {
		if (!id || activeTab !== 'table') return;
		seasonApi.getStandings(id)
			.then((res) => setStandings(res.data))
			.catch((err) => console.error(err));
	}, [id, activeTab, games]);

	const counts = useMemo(() => ({
		teams: teams.length || teamCount(season),
		games: games.length,
		played: games.filter(isPlayed).length,
		undated: games.filter(needsDate).length,
	}), [teams, games, season]);

	const applyGames = useCallback((updated: Game[]) => {
		setGames((prev) => {
			const byId = new Map(updated.map((g) => [g.id, g]));
			return prev.map((g) => byId.get(g.id) ?? g);
		});
	}, []);

	const handleBack = () => {
		navigate(isAdmin() ? '/admin/seasons' : '/season-management/my-seasons');
	};

	const tabs = [
		{ id: 'overview' as SeasonTab, icon: Trophy, label: t('seasonManagement.tabs.season') },
		{ id: 'games' as SeasonTab, icon: CalendarDays, label: t('seasonManagement.tabs.games') },
		{ id: 'teams' as SeasonTab, icon: Users, label: t('seasonManagement.tabs.teams') },
		{ id: 'table' as SeasonTab, icon: Table2, label: t('seasonManagement.tabs.table') },
		{ id: 'more' as SeasonTab, icon: MoreHorizontal, label: t('seasonManagement.tabs.more') },
	];

	if (loading && !season) {
		return (
			<div className="flex min-h-screen items-center justify-center">{t('common.loading')}</div>
		);
	}

	if (!season) {
		return (
			<div className="flex min-h-screen items-center justify-center">{t('seasonManagement.notFound')}</div>
		);
	}

	const tone = SEASON_STATUS_TONE[season.status];

	const statTiles = (
		<div className="mt-3.5 grid grid-cols-3 gap-px overflow-hidden rounded-[10px] bg-white/20">
			{[
				{ value: counts.teams, label: t('seasonManagement.stats.teams') },
				{ value: counts.games, label: t('seasonManagement.stats.games') },
				{ value: counts.played, label: t('seasonManagement.stats.played') },
			].map((tile) => (
				<div
					key={tile.label}
					className="flex flex-col items-center gap-px py-2.5"
					style={{ backgroundColor: 'rgba(0,0,0,0.14)' }}
				>
					<span className="text-lg font-bold leading-none tabular-nums">{tile.value}</span>
					<span className="text-[10.5px] uppercase tracking-wide text-white/85">{tile.label}</span>
				</div>
			))}
		</div>
	);

	return (
		<div className="flex min-h-screen flex-col bg-background lg:flex-row">
			{/* Mobile/tablet header */}
			<div
				className="tm-team-header sticky top-0 z-10 border-b text-white shadow-md lg:hidden"
				style={{ backgroundColor: SEASON_ACCENT }}
			>
				<div className="px-4 py-3">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="sm"
							className="-ml-2 text-white hover:bg-white/20"
							onClick={handleBack}
						>
							<ArrowLeft className="size-5" />
						</Button>
						<div className="min-w-0 flex-1">
							{season.league && (
								<p className="truncate text-xs text-white/85">{season.league.name}</p>
							)}
							<h1 className="truncate text-lg font-bold">{season.name}</h1>
						</div>
						<span
							className="tm-status-pill shrink-0 uppercase tracking-wide"
							style={{ backgroundColor: tone.bg, color: tone.fg }}
						>
							{t(`seasonManagement.status.${season.status}`)}
						</span>
					</div>
					{activeTab === 'overview' && statTiles}
				</div>
			</div>

			{/* Desktop sidebar */}
			<div
				className="hidden border-r text-white shadow-sm lg:flex lg:w-64 lg:flex-col"
				style={{ backgroundColor: SEASON_ACCENT }}
			>
				<div className="border-b border-white/20 p-6">
					<Button
						variant="ghost"
						size="sm"
						className="-ml-2 mb-4 text-white hover:bg-white/20"
						onClick={handleBack}
					>
						<ArrowLeft className="mr-2 size-5" />
						{t('common.back')}
					</Button>
					<h1 className="text-2xl font-bold">{season.name}</h1>
					{season.league && <p className="mt-2 text-sm opacity-80">{season.league.name}</p>}
				</div>
				<nav className="flex-1 space-y-2 p-4">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
								activeTab === tab.id ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'
							}`}
						>
							<tab.icon className="size-5" />
							<span className="font-medium">{tab.label}</span>
						</button>
					))}
				</nav>
			</div>

			{/* Main content */}
			<div className="flex flex-1 flex-col">
				<div className="hidden border-b bg-card lg:block">
					<div className="px-6 py-4">
						<h2 className="text-xl font-semibold text-foreground">
							{tabs.find((tab) => tab.id === activeTab)?.label}
						</h2>
					</div>
				</div>

				<div className="tm-content flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
					{activeTab === 'overview' && (
						<OverviewTab
							season={season}
							games={games}
							teamCount={counts.teams}
							undatedCount={counts.undated}
							onTabChange={setActiveTab}
							onOpenDates={setDatesRound}
							onOpenResult={setResultGame}
							onSeasonChange={setSeason}
						/>
					)}
					{activeTab === 'games' && (
						<GamesTab
							games={games}
							onOpenDates={setDatesRound}
							onOpenResult={setResultGame}
						/>
					)}
					{activeTab === 'teams' && (
						<TeamsTab season={season} teams={teams} onTeamsChange={setTeams} />
					)}
					{activeTab === 'table' && <StandingsTab standings={standings} />}
					{activeTab === 'more' && (
						<MoreTab
							season={season}
							teamCount={counts.teams}
							gameCount={counts.games}
							onGamesChange={setGames}
						/>
					)}
				</div>

				{/* Mobile bottom navigation */}
				<div className="tm-bottom-nav lg:hidden">
					<div className="grid h-14 grid-cols-5">
						{tabs.map((tab) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`tm-bottom-nav-item ${activeTab === tab.id ? 'is-active' : ''}`}
								style={activeTab === tab.id ? { color: SEASON_ACCENT } : undefined}
							>
								<tab.icon className="size-5" />
								<span>{tab.label}</span>
							</button>
						))}
					</div>
				</div>
			</div>

			{datesRound !== null && (
				<RoundDatesSheet
					round={datesRound}
					games={games}
					onClose={() => setDatesRound(null)}
					onSaved={(updated) => {
						applyGames(updated);
						setDatesRound(null);
					}}
				/>
			)}

			{resultGame && (
				<ResultSheet
					game={resultGame}
					onClose={() => setResultGame(null)}
					onSaved={(updated) => {
						applyGames([updated]);
						setResultGame(null);
					}}
				/>
			)}
		</div>
	);
}
