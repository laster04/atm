import { JSX, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { seasonApi, gameApi, gameStatisticApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Season, Game, Standing, TopScorer } from '@/types';
import { mapArchivedPlayerStat } from '@/utils/archivedStats';
import { LIVE_REFRESH_MS, hasLiveGames } from '@/utils/liveTable';

import StandingsTable from './components/StandingsTable';
import ScheduleList from './components/ScheduleList';
import TeamsGrid from './components/TeamsGrid';
import { BarChart3, CalendarDays, Trophy, Users, LayoutGrid } from 'lucide-react';
import { formatSeasonDate } from '@/utils/date';
import { PublicHero, SectionTabs, SeasonStatusBadge, type SectionTab } from '@/components/public';

import { StatsOverview } from "@/pages/SeasonDetail/components/StatsOverview.tsx";
import PlayersStatsTable from "@/pages/SeasonDetail/components/PlayersStatsTable.tsx";

export enum TabSeasonDetailType {
  OVERVIEW = 'overview',
  STANDINGS = 'standings',
  SCHEDULE = 'schedule',
  TEAMS = 'teams',
  PLAYERS = 'players'
}

export default function SeasonDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || TabSeasonDetailType.OVERVIEW;

  const setActiveTab = (tab: TabSeasonDetailType) => {
    setSearchParams({ tab }, { replace: true });
  };
  const [season, setSeason] = useState<Season | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [loading, setLoading] = useState(true);

  useDocumentTitle([season?.league?.name, season?.name]);

  // The table shows where teams would finish if the games in progress ended now,
  // so while any are running it re-reads itself. A settled season polls nothing.
  const hasLive = hasLiveGames(standings);
  useEffect(() => {
    if (!id || !hasLive) return;
    const timer = setInterval(() => {
      seasonApi.getStandings(id)
        .then((res) => setStandings(res.data))
        .catch((error) => console.error(error));
    }, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [id, hasLive]);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const seasonRes = await seasonApi.getById(id);
        setSeason(seasonRes.data);

        if (seasonRes.data.archivedAt) {
          const [standingsRes, playerStatsRes] = await Promise.all([
            seasonApi.getArchivedStandings(id),
            gameStatisticApi.getArchivedPlayerStats(id)
          ]);
          setGames([]);
          setStandings(standingsRes.data);
          setTopScorers(playerStatsRes.data.slice(0, 20).map(mapArchivedPlayerStat));
        } else {
          const [gamesRes, standingsRes, topScorersRes] = await Promise.all([
            gameApi.getBySeason(id),
            seasonApi.getStandings(id),
            gameStatisticApi.getTopScorersBySeason(id, 20)
          ]);
          setGames(gamesRes.data);
          setStandings(standingsRes.data);
          setTopScorers(topScorersRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch season data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading && !season) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
        {t('seasonDetail.loading')}
      </div>
    );
  }

  if (!season) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
        {t('seasonDetail.notFound')}
      </div>
    );
  }

  const isArchived = !!season.archivedAt;

  const tabs: { id: TabSeasonDetailType; label: string; icon: JSX.Element; content: JSX.Element }[] = [
    { id: TabSeasonDetailType.OVERVIEW, label: t('seasonDetail.tabs.overview'), icon: <BarChart3 className="size-4" />, content: <StatsOverview seasonId={season.id} standings={standings} games={games} archived={isArchived} /> },
    { id: TabSeasonDetailType.STANDINGS, label: t('seasonDetail.tabs.standings'), icon: <Trophy className="size-4" />, content: <StandingsTable standings={standings} games={games} /> },
    ...(isArchived ? [] : [{ id: TabSeasonDetailType.SCHEDULE, label: t('seasonDetail.tabs.schedule'), icon: <CalendarDays className="size-4" />, content: <ScheduleList games={games} /> }]),
    { id: TabSeasonDetailType.TEAMS, label: t('seasonDetail.tabs.teams'), icon: <LayoutGrid className="size-4" />, content: <TeamsGrid teams={season.teams || []} /> },
    { id: TabSeasonDetailType.PLAYERS, label: t('seasonDetail.tabs.players'), icon: <Users className="size-4" />, content: <PlayersStatsTable topScorers={topScorers || []} /> },
  ];

  const sectionTabs: SectionTab<TabSeasonDetailType>[] = tabs.map(({ id, label, icon }) => ({ value: id, label, icon }));
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const teamCount = season._count?.seasonTeams ?? season._count?.teams ?? season.teams?.length ?? 0;

  return (
    <>
      <PublicHero
        title={season.name}
        subtitle={season.league?.name}
        sport={season.league?.sportType}
        badge={<SeasonStatusBadge status={season.status} archived={isArchived} />}
        crumbs={[
          { label: t('public.nav.home'), to: '/' },
          { label: t('public.seasons.title'), to: '/seasons' },
          { label: season.name },
        ]}
        meta={
          <>
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 text-brand" />
              {formatSeasonDate(season.startDate, i18n.language)} – {formatSeasonDate(season.endDate, i18n.language)}
            </span>
            <span className="flex items-center gap-2">
              <Users className="size-4 text-brand" />
              {t('public.teams.count', { count: teamCount })}
            </span>
            <span className="flex items-center gap-2">
              <Trophy className="size-4 text-brand" />
              {t('public.games.count', { count: season._count?.games ?? games.length })}
            </span>
          </>
        }
      />

      <SectionTabs tabs={sectionTabs} value={current.id} onChange={setActiveTab} />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-7 sm:px-8">
        {isArchived && (
          <div className="rounded-xl border border-warning-soft bg-warning-soft px-4 py-3 text-sm text-warning-strong">
            {t('seasonDetail.archivedNotice')}
          </div>
        )}
        {current.content}
      </div>
    </>
  );
}
