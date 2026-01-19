import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSeasons } from '../../store/slices/seasonsSlice';
import { fetchMyTeams } from '../../store/slices/teamsSlice';

import FeaturesSection from './components/FeaturesSection';
import MyTeamsSection from './components/MyTeamsSection';
import ActiveSeasonsSection from './components/ActiveSeasonsSection';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, isTeamManager } = useAuth();
  const dispatch = useAppDispatch();

  const { items: seasons, loading: seasonsLoading } = useAppSelector((state) => state.seasons);
  const { myTeams } = useAppSelector((state) => state.teams);

  const activeSeasons = seasons.filter((s) => s.status === 'ACTIVE').slice(0, 3);

  useEffect(() => {
    dispatch(fetchSeasons());
  }, [dispatch]);

  useEffect(() => {
    if (isTeamManager()) {
      dispatch(fetchMyTeams());
    }
  }, [dispatch, user, isTeamManager]);

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
