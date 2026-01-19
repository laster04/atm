import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSeasons } from '../../store/slices/seasonsSlice';

import SeasonFilters, { type FilterValue } from './components/SeasonFilters';
import SeasonCard from './components/SeasonCard';

export default function SeasonsScreen() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [filter, setFilter] = useState<FilterValue>('all');

  const { items: seasons, loading } = useAppSelector((state) => state.seasons);

  useEffect(() => {
    dispatch(fetchSeasons());
  }, [dispatch]);

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
