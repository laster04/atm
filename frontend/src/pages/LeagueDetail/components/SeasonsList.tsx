import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatSeasonDate } from '@/utils/date';
import type { Season, SeasonStatus } from '@types';

interface SeasonsListProps {
  seasons: Season[];
}

export default function SeasonsList({ seasons }: SeasonsListProps) {
  const { t, i18n } = useTranslation();

  const statusBadge = (status: SeasonStatus) => {
    const colors: Record<SeasonStatus, string> = {
      DRAFT: 'bg-gray-200 text-gray-700',
      ACTIVE: 'bg-green-200 text-green-700',
      COMPLETED: 'bg-blue-200 text-blue-700',
    };
    return (
      <span className={`px-2 py-1 rounded text-sm ${colors[status]}`}>
        {t(`seasons.status.${status}`)}
      </span>
    );
  };

  if (seasons.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
        {t('leagueDetail.noSeasons')}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {seasons.map((season) => (
        <Link
          key={season.id}
          to={`/seasons/${season.id}`}
          className="block bg-white p-5 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-semibold">{season.name}</h3>
            {statusBadge(season.status)}
          </div>
          <p className="text-sm text-gray-500">
            {formatSeasonDate(season.startDate, i18n.language)} - {formatSeasonDate(season.endDate, i18n.language)}
          </p>
          <div className="mt-3 pt-3 border-t flex justify-between text-sm text-gray-500">
            <span>
              {season._count?.teams || 0} {t('common.teams')}
            </span>
            <span>
              {season._count?.games || 0} {t('common.games')}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
