import { useTranslation } from 'react-i18next';
import type { Season } from '@types';

interface SeasonsListProps {
  seasons: Season[];
  selectedSeason: Season | null;
  onSelectSeason: (season: Season) => void;
  onDeleteSeason: (id: number) => void;
  onCreateSeason: () => void;
  canDelete: (season: Season) => boolean;
}

export default function SeasonsList({
  seasons,
  selectedSeason,
  onSelectSeason,
  onDeleteSeason,
  onCreateSeason,
  canDelete,
}: SeasonsListProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{t('admin.seasons.title')}</h2>
        <button
          onClick={onCreateSeason}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
        >
          {t('admin.seasons.new')}
        </button>
      </div>
      <div className="space-y-2">
        {seasons.map((season) => (
          <div
            key={season.id}
            className={`p-3 rounded cursor-pointer flex justify-between items-center ${
              selectedSeason?.id === season.id
                ? 'bg-blue-100 border border-blue-300'
                : 'bg-gray-50 hover:bg-gray-100'
            }`}
            onClick={() => onSelectSeason(season)}
          >
            <div>
              <div className="font-medium">{season.name}</div>
              <div className="text-sm text-gray-500">{season.sportType}</div>
            </div>
            {canDelete(season) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSeason(season.id);
                }}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                {t('common.delete')}
              </button>
            )}
          </div>
        ))}
        {seasons.length === 0 && (
          <p className="text-gray-500 text-center py-4">{t('admin.seasons.noSeasons')}</p>
        )}
      </div>
    </div>
  );
}
