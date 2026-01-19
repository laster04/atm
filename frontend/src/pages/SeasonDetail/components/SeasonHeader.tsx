import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Season } from '@types';

interface SeasonHeaderProps {
  season: Season;
}

export default function SeasonHeader({ season }: SeasonHeaderProps) {
  const { t } = useTranslation();

  const statusClasses =
    season.status === 'ACTIVE'
      ? 'bg-green-200 text-green-700'
      : season.status === 'COMPLETED'
        ? 'bg-blue-200 text-blue-700'
        : 'bg-gray-200 text-gray-700';

  return (
    <>
      <div className="mb-6">
        <Link to="/seasons" className="text-blue-600 hover:underline">
          ← {t('seasonDetail.backToSeasons')}
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{season.name}</h1>
            <p className="text-gray-600 text-lg">{season.sportType}</p>
          </div>
          <span className={`px-3 py-1 rounded ${statusClasses}`}>
            {t(`seasons.status.${season.status}`)}
          </span>
        </div>
      </div>
    </>
  );
}
