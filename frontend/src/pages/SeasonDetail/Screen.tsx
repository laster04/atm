import { JSX, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { seasonApi, gameApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Season, Game, Standing } from '@/types';

import SeasonHeader from './components/SeasonHeader';
import StandingsTable from './components/StandingsTable';
import ScheduleList from './components/ScheduleList';
import TeamsGrid from './components/TeamsGrid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/base/tabs";
import { BarChart3, Calendar, Trophy, Users } from "lucide-react";
import { StatsOverview } from "@/pages/SeasonDetail/components/StatsOverview.tsx";

export enum TabSeasonDetailType {
  OVERVIEW = 'overview',
  STANDINGS = 'standings',
  SCHEDULE = 'schedule',
  TEAMS = 'teams',
}

export default function SeasonDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || TabSeasonDetailType.OVERVIEW;

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };
  const [season, setSeason] = useState<Season | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useDocumentTitle([season?.league?.name, season?.name]);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [seasonRes, gamesRes, standingsRes] = await Promise.all([
          seasonApi.getById(id),
          gameApi.getBySeason(id),
          seasonApi.getStandings(id),
        ]);
        setSeason(seasonRes.data);
        setGames(gamesRes.data);
        setStandings(standingsRes.data);
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
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('seasonDetail.loading')}</div>
    );
  }

  if (!season) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('seasonDetail.notFound')}</div>
    );
  }

  const tabs: { id: TabSeasonDetailType; label: string, icon: any, content: JSX.Element }[] = [
    { id: TabSeasonDetailType.OVERVIEW, label: t('seasonDetail.tabs.overview'), icon: <BarChart3 className="size-4" />, content: <StatsOverview seasonId={season.id} standings={standings} games={games} /> },
    { id: TabSeasonDetailType.STANDINGS, label: t('seasonDetail.tabs.standings'), icon: <Trophy className="size-4" />, content: <StandingsTable standings={standings} games={games} /> },
    { id: TabSeasonDetailType.SCHEDULE, label: t('seasonDetail.tabs.schedule'), icon: <Calendar className="size-4" />, content: <ScheduleList games={games} /> },
    { id: TabSeasonDetailType.TEAMS, label: t('seasonDetail.tabs.teams'), icon: <Users className="size-4" />, content: <TeamsGrid teams={season.teams || []} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8">
      <SeasonHeader season={season} />

      <main className="container mx-auto py-8">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4">
            {tabs.map((tab) => (
                <TabsTrigger value={tab.id} key={tab.id} className="flex items-center gap-2">
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
              <TabsContent value={tab.id} key={tab.id} className="space-y-6">
                {tab.content}
              </TabsContent>
          ))}
        </Tabs>

      </main>

    </div>
  );
}
