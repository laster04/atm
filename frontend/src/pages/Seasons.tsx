import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { seasonApi } from '../services/api';
import type { Season, SeasonStatus } from '../types';

export default function Seasons() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | SeasonStatus>('all');

  useEffect(() => {
    seasonApi.getAll()
      .then(res => setSeasons(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredSeasons = filter === 'all'
    ? seasons
    : seasons.filter(s => s.status === filter);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const statusBadge = (status: SeasonStatus) => {
    const colors: Record<SeasonStatus, string> = {
      DRAFT: 'bg-gray-200 text-gray-700',
      ACTIVE: 'bg-green-200 text-green-700',
      COMPLETED: 'bg-blue-200 text-blue-700'
    };
    return (
      <span className={`px-2 py-1 rounded text-sm ${colors[status]}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        Loading seasons...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Seasons</h1>

        <div className="flex gap-2">
          {(['all', 'ACTIVE', 'DRAFT', 'COMPLETED'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 rounded ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      {filteredSeasons.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          No seasons found.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSeasons.map(season => (
            <Link
              key={season.id}
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
                <span>{season._count?.teams} teams</span>
                <span>{season._count?.games} games</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
