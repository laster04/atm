import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchLeagues } from '../../store/slices/leaguesSlice';

import LeagueFilters, { type FilterValue } from './components/LeagueFilters';
import LeagueCard from './components/LeagueCard';

export default function LeaguesScreen() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [filter, setFilter] = useState<FilterValue>('all');

  const { items: leagues, loading } = useAppSelector((state) => state.leagues);

  useEffect(() => {
    dispatch(fetchLeagues());
  }, [dispatch]);

  const filteredLeagues = filter === 'all'
    ? leagues
    : leagues.filter((l) => l.sportType === filter);

  if (loading && leagues.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('leagues.loading')}</div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('leagues.title')}</h1>
        <LeagueFilters filter={filter} onFilterChange={setFilter} />
      </div>

      {filteredLeagues.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          {t('leagues.noLeagues')}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeagues.map((league) => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </div>
      )}
    </div>
  );
}
