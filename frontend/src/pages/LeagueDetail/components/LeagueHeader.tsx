import { useTranslation } from 'react-i18next';
import type { League } from '@types';

interface LeagueHeaderProps {
  league: League;
}

export default function LeagueHeader({ league }: LeagueHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{league.name}</h1>
          <p className="text-gray-600 mt-1">{t(`sports.${league.sportType}`)}</p>
          {league.description && (
            <p className="text-gray-500 mt-2">{league.description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">{t('leagueDetail.seasonsCount')}</div>
          <div className="text-2xl font-bold">{league._count?.seasons || league.seasons?.length || 0}</div>
        </div>
      </div>
    </div>
  );
}
