import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useAppDispatch, useAppSelector } from '@/store/hooks.ts';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { fetchTeamById } from '@/store/slices/teamsSlice.ts';
import { fetchPlayersByTeam, createPlayer, updatePlayer, deletePlayer } from '@/store/slices/playersSlice.ts';
import type { Player } from '@types';

import TeamHeader from './components/TeamHeader';
import RosterTable from './components/RosterTable';
import GamesList from './components/GamesList';
import PlayerFormModal, { type PlayerFormData } from './components/PlayerFormModal';

export default function TeamDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { canManageTeam } = useAuth();
  const dispatch = useAppDispatch();

  const { currentTeam: team, loading } = useAppSelector((state) => state.teams);
  const { items: playersByTeamId } = useAppSelector((state) => state.players);

  useDocumentTitle([team?.season?.league?.name, team?.season?.name, team?.name]);

  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const players = id ? playersByTeamId[Number(id)] || [] : [];

  useEffect(() => {
    if (!id) return;
    dispatch(fetchTeamById(id));
    dispatch(fetchPlayersByTeam(id));
  }, [dispatch, id]);

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
      await dispatch(updatePlayer({ id: editingPlayer.id, data: playerData }));
    } else {
      await dispatch(createPlayer({ teamId: team.id, data: playerData }));
    }
    setShowPlayerModal(false);
  };

  const handleDeletePlayer = async (playerId: number) => {
    if (!confirm(t('teamDetail.confirm.deletePlayer'))) return;
    if (!team) return;
    dispatch(deletePlayer({ id: playerId, teamId: team.id }));
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
