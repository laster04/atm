import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { teamApi } from '../services/api';
import type { Team } from '../types';

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    teamApi.getById(id)
      .then(res => setTeam(res.data))
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
        Loading team...
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        Team not found.
      </div>
    );
  }

  const upcomingGames = team.games?.filter(g => g.status === 'SCHEDULED') || [];
  const completedGames = team.games?.filter(g => g.status === 'COMPLETED') || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to={`/seasons/${team.season?.id}`} className="text-blue-600 hover:underline">
          ← Back to {team.season?.name}
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h1 className="text-3xl font-bold mb-2">{team.name}</h1>
        <p className="text-gray-600">
          {team.season?.name} · {team.season?.sportType}
        </p>
        {team.manager && (
          <p className="text-gray-500 mt-2">
            Manager: {team.manager.name}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-bold mb-4">Roster ({team.players?.length || 0} players)</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {!team.players || team.players.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No players added yet.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">#</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {team.players.map(player => (
                    <tr key={player.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{player.number || '-'}</td>
                      <td className="px-4 py-3 font-medium">{player.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{player.position || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Games</h2>
          <div className="space-y-4">
            {upcomingGames.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">UPCOMING</h3>
                {upcomingGames.slice(0, 5).map(game => (
                  <div key={game.id} className="bg-white p-3 rounded-lg shadow mb-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {game.homeTeamId === team.id ? 'vs' : '@'}{' '}
                        {game.homeTeamId === team.id
                          ? game.awayTeam?.name
                          : game.homeTeam?.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(game.date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedGames.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">RECENT RESULTS</h3>
                {completedGames.slice(-5).reverse().map(game => {
                  const isHome = game.homeTeamId === team.id;
                  const teamScore = isHome ? game.homeScore : game.awayScore;
                  const oppScore = isHome ? game.awayScore : game.homeScore;
                  const result = (teamScore ?? 0) > (oppScore ?? 0) ? 'W' : (teamScore ?? 0) < (oppScore ?? 0) ? 'L' : 'D';
                  const resultColor = result === 'W' ? 'text-green-600' : result === 'L' ? 'text-red-600' : 'text-gray-600';

                  return (
                    <div key={game.id} className="bg-white p-3 rounded-lg shadow mb-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className={`font-bold ${resultColor} mr-2`}>{result}</span>
                          <span className="font-medium">
                            {isHome ? 'vs' : '@'}{' '}
                            {isHome ? game.awayTeam?.name : game.homeTeam?.name}
                          </span>
                        </div>
                        <span className="font-bold">
                          {teamScore} - {oppScore}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {upcomingGames.length === 0 && completedGames.length === 0 && (
              <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                No games scheduled.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
