import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { seasonApi } from '../../services/api';
import type { Season } from '@types';

import SeasonFilters, { type FilterValue } from './components/SeasonFilters';
import SeasonCard from './components/SeasonCard';

export default function SeasonsScreen() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    seasonApi.getAll()
      .then((res) => setSeasons(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredSeasons = filter === 'all' ? seasons : seasons.filter((s) => s.status === filter);

  if (loading && seasons.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('seasons.loading')}</div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('seasons.title')}</h1>
        <SeasonFilters filter={filter} onFilterChange={setFilter} />
      </div>

      {filteredSeasons.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          {t('seasons.noSeasons')}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSeasons.map((season) => (
            <SeasonCard key={season.id} season={season} />
          ))}
        </div>
      )}
    </div>
  );
}
