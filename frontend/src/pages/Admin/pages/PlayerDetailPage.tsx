import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit, ArrowRightLeft, Trash2 } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { playerApi, gameStatisticApi, seasonApi, teamApi } from '@/services/api';
import { Button } from '@components/base/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/base/card';
import { Dialog, DialogContent } from '@components/base/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@components/base/table';
import { formatGameDateTime } from '@/utils/date';
import type { Player, GameStatistic, Season, Team } from '@types';
import PlayerFormModal, { type PlayerFormData } from '../components/players/PlayerFormModal';
import MovePlayerModal from '../components/players/MovePlayerModal';

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [player, setPlayer] = useState<Player | null>(null);
  const [statistics, setStatistics] = useState<GameStatistic[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  useDocumentTitle([t('admin.tabs.player.title'), player?.name]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      playerApi.getById(id),
      gameStatisticApi.getByPlayer(id),
      seasonApi.getAll()
    ])
      .then(([playerRes, statsRes, seasonsRes]) => {
        setPlayer(playerRes.data);
        setStatistics(statsRes.data);
        setSeasons(seasonsRes.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  // Load all teams when player is loaded (for move modal)
  useEffect(() => {
    if (!player?.team?.seasonId) return;
    // Load teams from all seasons for the move modal
    const loadTeams = async () => {
      const teamsPromises = seasons.map(s => teamApi.getBySeason(s.id));
      const results = await Promise.all(teamsPromises);
      const teams = results.flatMap(r => r.data);
      setAllTeams(teams);
    };
    if (seasons.length > 0) {
      loadTeams();
    }
  }, [player?.team?.seasonId, seasons]);

  const handleUpdatePlayer = async (data: PlayerFormData) => {
    if (!player) return;
    try {
      const res = await playerApi.update(player.id, data);
      setPlayer(res.data);
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Failed to update player:', err);
    }
  };

  const handleMovePlayer = async (playerId: number, targetTeamId: number) => {
    try {
      const res = await playerApi.move(playerId, targetTeamId);
      setPlayer(res.data);
      setIsMoveModalOpen(false);
    } catch (err) {
      console.error('Failed to move player:', err);
    }
  };

  const handleDeletePlayer = async () => {
    if (!player) return;
    if (!confirm(t('admin.confirm.deletePlayer'))) return;
    try {
      await playerApi.delete(player.id);
      navigate('/admin/players');
    } catch (err) {
      console.error('Failed to delete player:', err);
    }
  };

  if (loading && !player) {
    return (
      <div className="text-center py-8">{t('playerDetail.loading')}</div>
    );
  }

  if (!player) {
    return (
      <div className="text-center py-8">{t('playerDetail.notFound')}</div>
    );
  }

  // Calculate totals
  const totalGoals = statistics.reduce((sum, s) => sum + (s.goals || 0), 0);
  const totalAssists = statistics.reduce((sum, s) => sum + (s.assists || 0), 0);
  const gamesPlayed = statistics.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/players')}>
            <ArrowLeft className="size-4 mr-2" />
            {t('admin.tabs.player.title')}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
            <Edit className="size-4 mr-2" />
            {t('common.edit')}
          </Button>
          <Button variant="outline" onClick={() => setIsMoveModalOpen(true)}>
            <ArrowRightLeft className="size-4 mr-2" />
            {t('admin.modal.movePlayer')}
          </Button>
          <Button variant="destructive" onClick={handleDeletePlayer}>
            <Trash2 className="size-4 mr-2" />
            {t('common.delete')}
          </Button>
        </div>
      </div>

      {/* Player Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {player.number && (
              <div className="text-5xl font-bold text-gray-300">#{player.number}</div>
            )}
            <div>
              <h1 className="text-3xl font-bold">{player.name}</h1>
              {player.position && (
                <p className="text-lg text-muted-foreground">{player.position}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column - Info and Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Player Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('playerDetail.info.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('playerDetail.info.name')}</p>
                  <p className="font-medium">{player.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('playerDetail.info.number')}</p>
                  <p className="font-medium">{player.number ?? '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('playerDetail.info.position')}</p>
                  <p className="font-medium">{player.position || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('playerDetail.info.bornYear')}</p>
                  <p className="font-medium">{player.bornYear ?? '-'}</p>
                </div>
                {player.note && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">{t('playerDetail.info.note')}</p>
                    <p className="font-medium">{player.note}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>{t('playerDetail.statistics.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{gamesPlayed}</p>
                  <p className="text-sm text-muted-foreground">{t('playerDetail.statistics.gamesPlayed')}</p>
                </div>
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{totalGoals}</p>
                  <p className="text-sm text-muted-foreground">{t('playerDetail.statistics.goals')}</p>
                </div>
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-600">{totalAssists}</p>
                  <p className="text-sm text-muted-foreground">{t('playerDetail.statistics.assists')}</p>
                </div>
              </div>

              {/* Game by game stats */}
              {statistics.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    {t('playerDetail.statistics.gameByGame')}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('playerDetail.statistics.date')}</TableHead>
                        <TableHead>{t('playerDetail.statistics.game')}</TableHead>
                        <TableHead className="text-center">{t('playerDetail.statistics.goals')}</TableHead>
                        <TableHead className="text-center">{t('playerDetail.statistics.assists')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statistics.map((stat) => (
                        <TableRow key={stat.id}>
                          <TableCell className="text-muted-foreground">
                            {stat.game?.date ? formatGameDateTime(stat.game.date, i18n.language) : '-'}
                          </TableCell>
                          <TableCell>
                            <Link
                              to={`/game-statistic/${stat.game?.id}`}
                              className="hover:text-blue-600"
                            >
                              {stat.game?.homeTeam?.name} vs {stat.game?.awayTeam?.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-center font-medium">{stat.goals ?? 0}</TableCell>
                          <TableCell className="text-center font-medium">{stat.assists ?? 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  {t('playerDetail.statistics.noStatistics')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Team */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>{t('playerDetail.team.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {player.team ? (
                <Link
                  to={`/teams/${player.team.id}`}
                  className="block p-4 border rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {player.team.logo ? (
                      <img
                        src={player.team.logo}
                        alt={player.team.name}
                        className="w-12 h-12 object-contain"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center text-muted-foreground text-xl font-bold">
                        {player.team.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-lg">{player.team.name}</p>
                      {player.team.season && (
                        <p className="text-sm text-muted-foreground">{player.team.season.name}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ) : (
                <p className="text-muted-foreground">-</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <PlayerFormModal
            player={player}
            onSubmit={handleUpdatePlayer}
            onClose={() => setIsEditModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Move Modal */}
      <Dialog open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen}>
        <DialogContent>
          {player.team?.seasonId && (
            <MovePlayerModal
              player={player}
              teams={allTeams}
              seasons={seasons}
              currentSeasonId={player.team.seasonId}
              onSubmit={handleMovePlayer}
              onClose={() => setIsMoveModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
