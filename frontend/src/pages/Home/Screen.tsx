import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppDispatch, useAppSelector } from '@/store/hooks.ts';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { fetchSeasons } from '@/store/slices/seasonsSlice.ts';
import { fetchMyTeams } from '@/store/slices/teamsSlice.ts';

import ActiveSeasonsSection from './components/ActiveSeasonsSection';

export default function HomeScreen() {
  const { user, isTeamManager } = useAuth();
  const dispatch = useAppDispatch();

  useDocumentTitle();

  const { items: seasons, loading: seasonsLoading } = useAppSelector((state) => state.seasons);

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
      {/*<div className="text-center mb-12">*/}
      {/*  <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('home.title')}</h1>*/}
      {/*  <p className="text-xl text-gray-600 max-w-2xl mx-auto">{t('home.subtitle')}</p>*/}
      {/*</div>*/}

      {/*{isTeamManager() && <MyTeamsSection teams={myTeams} />}*/}

      {/*<FeaturesSection />*/}

      <ActiveSeasonsSection seasons={activeSeasons} loading={seasonsLoading} />
    </div>
  );
}
