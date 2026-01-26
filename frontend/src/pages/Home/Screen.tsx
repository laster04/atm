import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { seasonApi, teamApi } from '../../services/api';
import type { Season, Team } from '@types';

import FeaturesSection from './components/FeaturesSection';
import MyTeamsSection from './components/MyTeamsSection';
import ActiveSeasonsSection from './components/ActiveSeasonsSection';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, isTeamManager } = useAuth();

  useDocumentTitle();

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('home.title')}</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">{t('home.subtitle')}</p>
      </div>

      {isTeamManager() && <MyTeamsSection teams={myTeams} />}

      <FeaturesSection />

      <ActiveSeasonsSection seasons={activeSeasons} loading={seasonsLoading} />
    </div>
  );
}
