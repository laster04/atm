import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Award, Palette, Target, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useAppDispatch, useAppSelector } from '@/store/hooks.ts';
import { setTeamPrimaryColor, fetchTeamById, updateTeam } from '@/store/slices/teamsSlice.ts';
import { fetchPlayersByTeam, createPlayer, updatePlayer, deletePlayer } from '@/store/slices/playersSlice.ts';
import { Button } from '@components/base/button.tsx';
import { seasonApi } from '@/services/api';

import type { Player, Standing } from '@types';
import RosterTable from '../TeamDetail/components/RosterTable';
import GamesList from '../TeamDetail/components/GamesList';
import PlayerFormModal, { type PlayerFormData } from '../TeamDetail/components/PlayerFormModal';
import { Card, CardTitle, CardHeader, CardDescription, CardContent } from "@/components/base/card";
import { Label } from "@/components/base/label";
import { Input } from "@/components/base/input";

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canManageTeam, isAdmin } = useAuth();
  const dispatch = useAppDispatch();
  const [standing, setStanding] = useState<Standing | undefined>();

  const { currentTeam: team, loading } = useAppSelector((state) => state.teams);
  const { items: playersByTeamId } = useAppSelector((state) => state.players);

  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const players = id ? playersByTeamId[Number(id)] || [] : [];

  useEffect(() => {
    if (!id) return;
    dispatch(fetchTeamById(id));
    dispatch(fetchPlayersByTeam(id));
  }, [dispatch, id]);

  useEffect(() => {

    const fetchData = async () => {
      if (!team || !team.season) return;
      try {
        const standingsRes = await seasonApi.getTeamStanding(team.season.id, team.id);
        setStanding(standingsRes.data);
      } catch (error) {
        console.error('Failed to fetch season data:', error);
      } finally {
      }
    };

    fetchData();
  }, [team]);

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

  const handleBack = () => {
    if (isAdmin()) {
      navigate('/admin');
    } else {
      navigate('/my-teams');
    }
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

  if (!canManage) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">{t('myTeams.accessDenied')}</h1>
        <p className="text-gray-600 mt-2">{t('myTeams.noPrivileges')}</p>
      </div>
    );
  }


  const handleColorChange = (teamId: number, color: string) => {
    dispatch(setTeamPrimaryColor(color));
    dispatch(
        updateTeam({
          id: teamId,
          data: {
            primaryColor: color,
          },
        })
    ).unwrap();
    toast.success(t('teamManagement.toast.colorUpdated', { name: team.name }));
  };

  const stats = [
    { title: t('teamManagement.stats.teamRecord'), value: standing ? `${standing.wins}-${standing.losses}-${standing?.draws}` : '', icon: Award },
    { title: t('teamManagement.stats.totalPoints'), value: standing ? standing.points.toString() : '', icon: TrendingUp },
    { title: t('teamManagement.stats.leagueRank'), value: 'TODO:', icon: Target },
  ];

  return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r text-white" style={{ backgroundColor: team.primaryColor ?? undefined }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl">{team.name}</CardTitle>
                <CardDescription className="text-blue-100">
                  {team.season && (
                      team.season.name
                  )}
                </CardDescription>
              </div>
              <div className="ml-4">

              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">{stat.title}</CardTitle>
                  <stat.icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-medium">{stat.value}</div>
                </CardContent>
              </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="size-5 text-primary" />
              <div>
                <CardTitle>{t('teamManagement.branding.title')}</CardTitle>
                <CardDescription>{t('teamManagement.branding.description', { name: team.name })}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-color">{t('teamManagement.branding.primaryColor')}</Label>
                  <div className="flex items-center gap-4">
                    <Input
                        id="team-color"
                        type="color"
                        value={team.primaryColor ?? undefined}
                        onChange={(e) => handleColorChange(team?.id, e.target.value)}
                        className="w-24 h-12 cursor-pointer"
                    />
                    <div className="flex-1">
                      <Input
                          type="text"
                          value={team.primaryColor ?? undefined}
                          onChange={(e) => handleColorChange(team?.id, e.target.value)}
                          className="font-mono"
                          placeholder="#000000"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('teamManagement.branding.colorUsageExplanation', { name: team.name })}
                  </p>
                </div>

                {/* Color Presets */}
                <div className="space-y-2">
                  <Label>{t('teamManagement.branding.quickPresets')}</Label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'blue', color: '#003E7E' },
                      { key: 'red', color: '#C8102E' },
                      { key: 'gold', color: '#FFB81C' },
                      { key: 'green', color: '#006847' },
                      { key: 'purple', color: '#552583' },
                      { key: 'orange', color: '#F74902' },
                      { key: 'navy', color: '#041E42' },
                      { key: 'teal', color: '#007A7A' },
                    ].map((preset) => (
                        <button
                            key={preset.key}
                            onClick={() => handleColorChange(team.id, preset.color)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-accent transition-colors"
                            title={t(`teamManagement.branding.colors.${preset.key}`)}
                        >
                          <div
                              className="size-6 rounded border"
                              style={{ backgroundColor: preset.color }}
                          />
                          <span className="text-sm">{t(`teamManagement.branding.colors.${preset.key}`)}</span>
                        </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className="w-64 space-y-4">
                <div className="text-sm font-medium">{t('teamManagement.branding.livePreview')}</div>
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="text-xs text-muted-foreground mb-2">{t('teamManagement.branding.standingsRow')}</div>
                  <div className="flex items-center gap-3 p-2 rounded" style={{ backgroundColor: `${team.primaryColor ?? undefined}15` }}>
                    <div className="size-3 rounded-full" style={{ backgroundColor: team.primaryColor ?? undefined }} />
                    <span className="text-sm font-medium">{team.name}</span>
                    <span className="text-sm ml-auto">{standing?.points} pts</span>
                  </div>

                  <div className="text-xs text-muted-foreground mb-2 mt-4">{t('teamManagement.branding.gameCard')}</div>
                  <div className="border rounded p-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full" style={{ backgroundColor: team.primaryColor ?? undefined }} />
                      <span className="text-sm font-medium">{team.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{t('teamManagement.branding.vsOpponent')}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>








      <div className="mb-6">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="size-4 mr-2" />
          {t('teamManagement.back')}
        </Button>
        <div className="flex items-center gap-4">
          {team.logo && (
            <img src={team.logo} alt={team.name} className="w-16 h-16 object-contain" />
          )}
          <div>
            <h1 className="text-3xl font-bold">{team.name}</h1>
            {team.season && (
              <p className="text-gray-600">{team.season.name}</p>
            )}
            {team.manager && (
              <p className="text-sm text-gray-500">
                {t('teamDetail.manager', { name: team.manager.name })}
              </p>
            )}
          </div>
        </div>
      </div>

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
