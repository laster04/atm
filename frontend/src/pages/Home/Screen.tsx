import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { seasonApi, teamApi } from '@/services/api.ts';
import type { Season, Team } from '@types';

import MyTeamsSection from './components/MyTeamsSection';
import ActiveSeasonsSection from './components/ActiveSeasonsSection';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, loading, isTeamManager } = useAuth();

  useDocumentTitle(['Dashboard']);

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);

  const activeSeasons = seasons.filter((s) => s.status === 'ACTIVE').slice(0, 3);

  useEffect(() => {
    setSeasonsLoading(true);
    seasonApi.getAll()
      .then((res) => setSeasons(res.data))
      .catch((err) => console.error(err))
      .finally(() => setSeasonsLoading(false));
  }, []);

  useEffect(() => {
    if (isTeamManager()) {
      teamApi.getMyTeams()
        .then((res) => setMyTeams(res.data))
        .catch((err) => console.error(err));
    }
  }, [user, isTeamManager]);

  if (!loading && !user) return <Navigate to="/" replace />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t('home.title')}</h1>
        <p className="text-gray-600 mt-1">{t('home.subtitle')}</p>
      </div>

      {isTeamManager() && <MyTeamsSection teams={myTeams} />}

      <ActiveSeasonsSection seasons={activeSeasons} loading={seasonsLoading} />
    </div>
  );
}
