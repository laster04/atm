import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { teamApi, playerApi } from '@/services/api';
import type { Player, Team } from '@types';

import TeamHeader from './components/TeamHeader';
import RosterTable from './components/RosterTable';
import GamesList from './components/GamesList';
import PlayerFormModal, { type PlayerFormData } from './components/PlayerFormModal';

export default function TeamDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { canManageTeam } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  useDocumentTitle([team?.season?.league?.name, team?.season?.name, team?.name]);

  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      teamApi.getById(id),
      playerApi.getByTeam(id)
    ])
      .then(([teamRes, playersRes]) => {
        setTeam(teamRes.data);
        setPlayers(playersRes.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const openAddPlayer = () => {
    setEditingPlayer(null);
    setShowPlayerModal(true);
  };

  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setShowPlayerModal(true);
  };

  const handleSavePlayer = async (data: PlayerFormData) => {
    if (!team) return;
    const playerData = {
      name: data.name,
      number: data.number ? parseInt(data.number) : undefined,
      position: data.position || undefined,
    };

    if (editingPlayer) {
      const res = await playerApi.update(editingPlayer.id, playerData);
      setPlayers((prev) => prev.map((p) => (p.id === editingPlayer.id ? res.data : p)));
    } else {
      const res = await playerApi.create(team.id, playerData);
      setPlayers((prev) => [...prev, res.data]);
    }
    setShowPlayerModal(false);
  };

  const handleDeletePlayer = async (playerId: number) => {
    if (!confirm(t('teamDetail.confirm.deletePlayer'))) return;
    if (!team) return;
    await playerApi.delete(playerId);
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
  };

  if (loading && !team) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('teamDetail.loading')}</div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('teamDetail.notFound')}</div>
    );
  }

  const canManage = canManageTeam(team.managerId);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <TeamHeader team={team} />

      <div className="grid lg:grid-cols-2 gap-6">
        <RosterTable
          players={players.length > 0 ? players : team.players || []}
          canManage={canManage}
          onAddPlayer={openAddPlayer}
          onEditPlayer={openEditPlayer}
          onDeletePlayer={handleDeletePlayer}
        />

        <GamesList games={team.games || []} teamId={team.id} />
      </div>

      {showPlayerModal && (
        <PlayerFormModal
          player={editingPlayer}
          onSubmit={handleSavePlayer}
          onClose={() => setShowPlayerModal(false)}
        />
      )}
    </div>
  );
}
