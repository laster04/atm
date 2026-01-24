import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { League } from '@types';

interface LeagueCardProps {
  league: League;
}

export default function LeagueCard({ league }: LeagueCardProps) {
  const { t } = useTranslation();

  return (
    <Link
      to={`/leagues/${league.id}`}
      className="block bg-white p-5 rounded-lg shadow hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-xl font-semibold">{league.name}</h2>
        <span className="px-2 py-1 rounded text-sm bg-blue-200 text-blue-700">
          {t(`sports.${league.sportType}`)}
        </span>
      </div>
      {league.description && (
        <p className="text-gray-600 mb-3 line-clamp-2">{league.description}</p>
      )}
      <div className="mt-3 pt-3 border-t flex justify-between text-sm text-gray-500">
        <span>
          {league._count?.seasons || 0} {t('common.seasons')}
        </span>
      </div>
    </Link>
  );
}
