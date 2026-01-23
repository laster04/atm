import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Season } from '@types';
import { Button } from "@/components/base/button";

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
        <Button variant="outline" >
          <Link to="/seasons">
            ← {t('seasonDetail.backToSeasons')}
          </Link>
        </Button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">{season.name}</h2>
            <p className="text-gray-600 text-lg">{season.league?.name || '-'}</p>
          </div>
          <span className={`px-3 py-1 rounded ${statusClasses}`}>
            {t(`seasons.status.${season.status}`)}
          </span>
        </div>
      </div>
    </>
  );
}
