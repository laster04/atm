import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { leagueApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { League } from '@/types';

import LeagueHeader from './components/LeagueHeader';
import SeasonsList from './components/SeasonsList';

export default function LeagueDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentTitle([league?.name]);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await leagueApi.getById(id);
        setLeague(response.data);
      } catch (error) {
        console.error('Failed to fetch league data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading && !league) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('leagueDetail.loading')}</div>
    );
  }

  if (!league) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('leagueDetail.notFound')}</div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <LeagueHeader league={league} />

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">{t('leagueDetail.seasons')}</h2>
        <SeasonsList seasons={league.seasons || []} />
      </div>
    </div>
  );
}
