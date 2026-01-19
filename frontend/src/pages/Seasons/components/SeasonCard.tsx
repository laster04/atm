import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Season, SeasonStatus } from '@types';

interface SeasonCardProps {
  season: Season;
}

export default function SeasonCard({ season }: SeasonCardProps) {
  const { t, i18n } = useTranslation();

  const formatDate = (date: string) => {
    const locale = i18n.language === 'cs' ? 'cs-CZ' : 'en-US';
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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

  return (
    <Link
      to={`/seasons/${season.id}`}
      className="block bg-white p-5 rounded-lg shadow hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-xl font-semibold">{season.name}</h2>
        {statusBadge(season.status)}
      </div>
      <p className="text-gray-600 mb-3">{season.sportType}</p>
      <p className="text-sm text-gray-500">
        {formatDate(season.startDate)} - {formatDate(season.endDate)}
      </p>
      <div className="mt-3 pt-3 border-t flex justify-between text-sm text-gray-500">
        <span>
          {season._count?.teams} {t('common.teams')}
        </span>
        <span>
          {season._count?.games} {t('common.games')}
        </span>
      </div>
    </Link>
  );
}
