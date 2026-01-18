import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { teamApi, playerApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Team, Player } from '../types';

interface PlayerFormData {
  name: string;
  number?: string;
  position?: string;
}

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const { t, i18n } = useTranslation();
  const { canManageTeam } = useAuth();
  const playerForm = useForm<PlayerFormData>();

  useEffect(() => {
    if (!id) return;

    teamApi.getById(id)
      .then(res => setTeam(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const formatDate = (date: string) => {
    const locale = i18n.language === 'cs' ? 'cs-CZ' : 'en-US';
    return new Date(date).toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const reloadTeam = () => {
    if (!id) return;
    teamApi.getById(id)
      .then(res => setTeam(res.data))
      .catch(err => console.error(err));
  };

  const openAddPlayer = () => {
    setEditingPlayer(null);
    playerForm.reset({ name: '', number: '', position: '' });
    setShowPlayerModal(true);
  };

  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    playerForm.reset({
      name: player.name,
      number: player.number?.toString() || '',
      position: player.position || ''
    });
    setShowPlayerModal(true);
  };

  const handleSavePlayer = async (data: PlayerFormData) => {
    if (!team) return;
    try {
      const playerData = {
        name: data.name,
        number: data.number ? parseInt(data.number) : undefined,
        position: data.position || undefined
      };
      if (editingPlayer) {
        await playerApi.update(editingPlayer.id, playerData);
      } else {
        await playerApi.create(team.id, playerData);
      }
      reloadTeam();
      setShowPlayerModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePlayer = async (playerId: number) => {
    if (!confirm(t('teamDetail.confirm.deletePlayer'))) return;
    try {
      await playerApi.delete(playerId);
      reloadTeam();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        {t('teamDetail.loading')}
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        {t('teamDetail.notFound')}
      </div>
    );
  }

  const upcomingGames = team.games?.filter(g => g.status === 'SCHEDULED') || [];
  const completedGames = team.games?.filter(g => g.status === 'COMPLETED') || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to={`/seasons/${team.season?.id}`} className="text-blue-600 hover:underline">
          ← {t('teamDetail.backTo', { name: team.season?.name })}
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h1 className="text-3xl font-bold mb-2">{team.name}</h1>
        <p className="text-gray-600">
          {team.season?.name} · {team.season?.sportType}
        </p>
        {team.manager && (
          <p className="text-gray-500 mt-2">
            {t('teamDetail.manager', { name: team.manager.name })}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{t('teamDetail.roster', { count: team.players?.length || 0 })}</h2>
            {canManageTeam(team.managerId) && (
              <button
                onClick={openAddPlayer}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                {t('teamDetail.addPlayer')}
              </button>
            )}
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {!team.players || team.players.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {t('teamDetail.noPlayers')}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">{t('teamDetail.playerTable.number')}</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">{t('teamDetail.playerTable.name')}</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">{t('teamDetail.playerTable.position')}</th>
                    {canManageTeam(team.managerId) && (
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">{t('teamDetail.playerTable.actions')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {team.players.map(player => (
                    <tr key={player.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{player.number || '-'}</td>
                      <td className="px-4 py-3 font-medium">{player.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{player.position || '-'}</td>
                      {canManageTeam(team.managerId) && (
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => openEditPlayer(player)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            {t('common.delete')}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">{t('teamDetail.games.title')}</h2>
          <div className="space-y-4">
            {upcomingGames.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">{t('teamDetail.games.upcoming')}</h3>
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
                <h3 className="text-sm font-semibold text-gray-500 mb-2">{t('teamDetail.games.recentResults')}</h3>
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
                {t('teamDetail.games.noGames')}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPlayerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingPlayer ? t('teamDetail.modal.editPlayer') : t('teamDetail.modal.addPlayer')}
            </h3>
            <form onSubmit={playerForm.handleSubmit(handleSavePlayer)}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">{t('teamDetail.modal.name')}</label>
                <input
                  type="text"
                  {...playerForm.register('name', { required: true })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('teamDetail.modal.number')}</label>
                  <input
                    type="number"
                    {...playerForm.register('number')}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('teamDetail.modal.position')}</label>
                  <input
                    type="text"
                    {...playerForm.register('position')}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPlayerModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingPlayer ? t('common.save') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
