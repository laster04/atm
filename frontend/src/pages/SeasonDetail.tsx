import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { seasonApi, gameApi } from '../services/api';
import type { Season, Game, Standing } from '../types';

export default function SeasonDetail() {
  const { id } = useParams<{ id: string }>();
  const [season, setSeason] = useState<Season | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'standings' | 'schedule' | 'teams'>('standings');

  useEffect(() => {
    if (!id) return;

    Promise.all([
      seasonApi.getById(id),
      gameApi.getBySeason(id),
      seasonApi.getStandings(id)
    ])
      .then(([seasonRes, gamesRes, standingsRes]) => {
        setSeason(seasonRes.data);
        setGames(gamesRes.data);
        setStandings(standingsRes.data);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        Loading season...
      </div>
    );
  }

  if (!season) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        Season not found.
      </div>
    );
  }

  const tabs = [
    { id: 'standings' as const, label: 'Standings' },
    { id: 'schedule' as const, label: 'Schedule' },
    { id: 'teams' as const, label: 'Teams' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/seasons" className="text-blue-600 hover:underline">
          ← Back to Seasons
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{season.name}</h1>
            <p className="text-gray-600 text-lg">{season.sportType}</p>
          </div>
          <span className={`px-3 py-1 rounded ${
            season.status === 'ACTIVE' ? 'bg-green-200 text-green-700' :
            season.status === 'COMPLETED' ? 'bg-blue-200 text-blue-700' :
            'bg-gray-200 text-gray-700'
          }`}>
            {season.status}
          </span>
        </div>
      </div>

      <div className="border-b mb-6">
        <nav className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 border-b-2 font-medium ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'standings' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">#</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Team</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">P</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">W</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">D</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">L</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">GF</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">GA</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">GD</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, idx) => (
                <tr key={row.team.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/teams/${row.team.id}`}
                      className="font-medium hover:text-blue-600"
                    >
                      {row.team.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">{row.played}</td>
                  <td className="px-4 py-3 text-center text-sm">{row.wins}</td>
                  <td className="px-4 py-3 text-center text-sm">{row.draws}</td>
                  <td className="px-4 py-3 text-center text-sm">{row.losses}</td>
                  <td className="px-4 py-3 text-center text-sm">{row.goalsFor}</td>
                  <td className="px-4 py-3 text-center text-sm">{row.goalsAgainst}</td>
                  <td className="px-4 py-3 text-center text-sm">{row.goalDifference}</td>
                  <td className="px-4 py-3 text-center font-bold">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {standings.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No standings data yet.
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {games.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
              No games scheduled yet.
            </div>
          ) : (
            games.map(game => (
              <div key={game.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-right pr-4">
                    <Link
                      to={`/teams/${game.homeTeam?.id}`}
                      className="font-medium hover:text-blue-600"
                    >
                      {game.homeTeam?.name}
                    </Link>
                  </div>
                  <div className="text-center px-4">
                    {game.status === 'COMPLETED' ? (
                      <span className="text-2xl font-bold">
                        {game.homeScore} - {game.awayScore}
                      </span>
                    ) : (
                      <span className="text-gray-400">vs</span>
                    )}
                  </div>
                  <div className="flex-1 pl-4">
                    <Link
                      to={`/teams/${game.awayTeam?.id}`}
                      className="font-medium hover:text-blue-600"
                    >
                      {game.awayTeam?.name}
                    </Link>
                  </div>
                </div>
                <div className="text-center mt-2 text-sm text-gray-500">
                  {formatDate(game.date)}
                  {game.location && ` · ${game.location}`}
                  {game.round && ` · Round ${game.round}`}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!season.teams || season.teams.length === 0 ? (
            <div className="col-span-full bg-white p-8 rounded-lg shadow text-center text-gray-500">
              No teams in this season yet.
            </div>
          ) : (
            season.teams.map(team => (
              <Link
                key={team.id}
                to={`/teams/${team.id}`}
                className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-lg">{team.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {team._count?.players} players
                </p>
                {team.manager && (
                  <p className="text-sm text-gray-500">
                    Manager: {team.manager.name}
                  </p>
                )}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
