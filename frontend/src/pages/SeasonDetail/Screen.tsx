import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSeasonById, fetchStandings } from '../../store/slices/seasonsSlice';
import { fetchGamesBySeason } from '../../store/slices/gamesSlice';

import SeasonHeader from './components/SeasonHeader';
import StandingsTable from './components/StandingsTable';
import ScheduleList from './components/ScheduleList';
import TeamsGrid from './components/TeamsGrid';

type TabId = 'standings' | 'schedule' | 'teams';

export default function SeasonDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<TabId>('standings');

  const { currentSeason: season, standings, loading } = useAppSelector((state) => state.seasons);
  const { items: gamesBySeasonId } = useAppSelector((state) => state.games);

  const seasonStandings = id ? standings[Number(id)] || [] : [];
  const games = id ? gamesBySeasonId[Number(id)] || [] : [];

  useEffect(() => {
    if (!id) return;
    dispatch(fetchSeasonById(id));
    dispatch(fetchGamesBySeason(id));
    dispatch(fetchStandings(id));
  }, [dispatch, id]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'standings', label: t('seasonDetail.tabs.standings') },
    { id: 'schedule', label: t('seasonDetail.tabs.schedule') },
    { id: 'teams', label: t('seasonDetail.tabs.teams') },
  ];

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SeasonHeader season={season} />

      <div className="border-b mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 border-b-2 font-medium ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'standings' && <StandingsTable standings={seasonStandings} />}
      {activeTab === 'schedule' && <ScheduleList games={games} />}
      {activeTab === 'teams' && <TeamsGrid teams={season.teams || []} />}
    </div>
  );
}
