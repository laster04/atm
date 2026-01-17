import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { seasonApi } from '../services/api';
import type { Season } from '../types';

export default function Home() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seasonApi.getAll()
      .then(res => setSeasons(res.data.filter(s => s.status === 'ACTIVE').slice(0, 3)))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Sport Season Scheduler
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Manage your sports leagues with ease. Create seasons, track teams,
          schedule games, and view standings all in one place.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">League Management</h3>
          <p className="text-gray-600">
            Create and manage multiple seasons with teams, players, and schedules.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">Auto Scheduling</h3>
          <p className="text-gray-600">
            Generate round-robin schedules automatically with just a few clicks.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">Live Standings</h3>
          <p className="text-gray-600">
            Track standings in real-time as game results are entered.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">Loading...</div>
      ) : seasons.length > 0 ? (
        <div>
          <h2 className="text-2xl font-bold mb-4">Active Seasons</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {seasons.map(season => (
              <Link
                key={season.id}
                to={`/seasons/${season.id}`}
                className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-lg">{season.name}</h3>
                <p className="text-gray-600">{season.sportType}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {season._count?.teams} teams · {season._count?.games} games
                </p>
              </Link>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link
              to="/seasons"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              View all seasons →
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-gray-500 mb-4">No active seasons yet.</p>
          <Link
            to="/seasons"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View all seasons →
          </Link>
        </div>
      )}
    </div>
  );
}
