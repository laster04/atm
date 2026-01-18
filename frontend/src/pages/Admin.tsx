import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { seasonApi, teamApi, gameApi, authApi } from '../services/api';
import type { Season, Team, SeasonStatus, User } from '../types';
import { AxiosError } from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from "@components/base/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/base/tabs.tsx";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@components/base/table";
import { Badge } from "@components/base/badge";
import { Button } from "@components/base/button";
// import { Edit, Trash2 } from "lucide-react";

interface SeasonFormData {
  name: string;
  sportType: string;
  startDate: string;
  endDate: string;
  status: SeasonStatus;
}

interface TeamFormData {
  name: string;
  managerId?: string;
}

type ModalType = 'season' | 'team' | null;

export default function Admin() {
  const { isAdmin, isSeasonManager } = useAuth();
  const { t } = useTranslation();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamManagers, setTeamManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<ModalType>(null);
  const [error, setError] = useState('');

  const seasonForm = useForm<SeasonFormData>({
    defaultValues: { status: 'DRAFT' }
  });

  const teamForm = useForm<TeamFormData>();

  useEffect(() => {
    loadSeasons();
    loadUsers();
    authApi.getUsers('TEAM_MANAGER')
      .then(res => setTeamManagers(res.data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      teamApi.getBySeason(selectedSeason.id)
        .then(res => setTeams(res.data))
        .catch(err => console.error(err));
    }
  }, [selectedSeason]);

  const loadSeasons = () => {
    // Season managers see only their seasons, admins see all
    const apiCall = isSeasonManager() ? seasonApi.getMySeasons() : seasonApi.getAll();
    apiCall
      .then(res => {
        setSeasons(res.data);
        if (res.data.length > 0 && !selectedSeason) {
          setSelectedSeason(res.data[0]);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const loadUsers = () => {
    const apiCall = authApi.getUsers();
    apiCall
        .then(res => {
          setUsers(res.data);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
  };

  if (!isAdmin() && !isSeasonManager()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">{t('admin.accessDenied')}</h1>
        <p className="text-gray-600 mt-2">{t('admin.noPrivileges')}</p>
      </div>
    );
  }

  const handleCreateSeason = async (data: SeasonFormData) => {
    setError('');
    try {
      await seasonApi.create(data);
      loadSeasons();
      setShowModal(null);
      seasonForm.reset({ status: 'DRAFT' });
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.createSeason'));
    }
  };

  const handleCreateTeam = async (data: TeamFormData) => {
    setError('');
    try {
      if (!selectedSeason) return;
      await teamApi.create(selectedSeason.id, {
        name: data.name,
        managerId: data.managerId ? parseInt(data.managerId) : undefined
      });
      const res = await teamApi.getBySeason(selectedSeason.id);
      setTeams(res.data);
      setShowModal(null);
      teamForm.reset();
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.createTeam'));
    }
  };

  const handleGenerateSchedule = async () => {
    if (!selectedSeason) return;
    setError('');
    try {
      const result = await gameApi.generateSchedule(selectedSeason.id, {
        startDate: selectedSeason.startDate,
        intervalDays: 7,
        doubleRoundRobin: true
      });
      alert(result.data.message);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.generateSchedule'));
    }
  };

  const handleDeleteSeason = async (id: number) => {
    if (!confirm(t('admin.confirm.deleteSeason'))) return;
    try {
      await seasonApi.delete(id);
      loadSeasons();
      if (selectedSeason?.id === id) {
        setSelectedSeason(null);
      }
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.deleteSeason'));
    }
  };

  const handleDeleteTeam = async (id: number) => {
    if (!confirm(t('admin.confirm.deleteTeam'))) return;
    try {
      await teamApi.delete(id);
      if (selectedSeason) {
        const res = await teamApi.getBySeason(selectedSeason.id);
        setTeams(res.data);
      }
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.deleteTeam'));
    }
  };

  const openSeasonModal = () => {
    seasonForm.reset({ status: 'DRAFT' });
    setShowModal('season');
  };

  const openTeamModal = () => {
    teamForm.reset();
    setShowModal('team');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-6">{t('admin.title')}</h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.tabs.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="user">
            <TabsList>
              <TabsTrigger value="user">{t('admin.tabs.user.title')}</TabsTrigger>
              <TabsTrigger value="season">{t('admin.tabs.season.title')}</TabsTrigger>
              <TabsTrigger value="team">{t('admin.tabs.team.title')}</TabsTrigger>
              <TabsTrigger value="player">{t('admin.tabs.player.title')}</TabsTrigger>
            </TabsList>
            <TabsContent value="user" className="space-y-4 mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.tabs.user.th-name')}</TableHead>
                    <TableHead>{t('admin.tabs.user.th-email')}</TableHead>
                    <TableHead>{t('admin.tabs.user.th-role')}</TableHead>
                    {/*<TableHead>Status</TableHead>*/}
                    <TableHead className="text-right">{t('admin.tabs.player.title')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{user.role}</Badge>
                        </TableCell>
                        {/*<TableCell>*/}
                        {/*  <Badge variant={user.status === 'Active' ? 'default' : 'outline'}>*/}
                        {/*    {user.status}*/}
                        {/*  </Badge>*/}
                        {/*</TableCell>*/}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm">
                              {/*<Edit className="size-4" />*/}
                            </Button>
                            <Button variant="ghost" size="sm">
                              {/*<Trash2 className="size-4 text-destructive" />*/}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="season" className="space-y-4 mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.tabs.season.th-name')}</TableHead>
                    <TableHead>{t('admin.tabs.season.th-sportType')}</TableHead>
                    <TableHead>{t('admin.tabs.season.th-startDate')}</TableHead>
                    <TableHead>{t('admin.tabs.season.th-endDate')}</TableHead>
                    <TableHead>{t('admin.tabs.season.th-status')}</TableHead>
                    <TableHead>{t('admin.tabs.season.th-created')}</TableHead>
                    <TableHead>{t('admin.tabs.season.th-manager')}</TableHead>
                    <TableHead>{t('admin.tabs.season.th-teams-c')}</TableHead>
                    {/*<TableHead>Status</TableHead>*/}
                    <TableHead className="text-right">{t('admin.tabs.season.th-actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seasons.map((season) => (
                      <TableRow key={season.id}>
                        <TableCell className="font-medium">{season.name}</TableCell>
                        <TableCell>{season.sportType}</TableCell>
                        <TableCell>{season.startDate}</TableCell>
                        <TableCell>{season.endDate}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{season.status}</Badge>
                        </TableCell>
                        <TableCell>{season.createdAt}</TableCell>
                        <TableCell>{season.manager?.name}</TableCell>
                        <TableCell>{season._count?.teams}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm">
                              {/*<Edit className="size-4" />*/}
                            </Button>
                            <Button variant="ghost" size="sm">
                              {/*<Trash2 className="size-4 text-destructive" />*/}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="team" className="space-y-4 mt-4">
              <span> team</span>
            </TabsContent>
            <TabsContent value="player" className="space-y-4 mt-4">
              <span> player</span>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{t('admin.seasons.title')}</h2>
              <button
                onClick={openSeasonModal}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                {t('admin.seasons.new')}
              </button>
            </div>
            <div className="space-y-2">
              {seasons.map(season => (
                <div
                  key={season.id}
                  className={`p-3 rounded cursor-pointer flex justify-between items-center ${
                    selectedSeason?.id === season.id
                      ? 'bg-blue-100 border border-blue-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedSeason(season)}
                >
                  <div>
                    <div className="font-medium">{season.name}</div>
                    <div className="text-sm text-gray-500">{season.sportType}</div>
                  </div>
                  {(isAdmin() || (isSeasonManager() && new Date(season.startDate) > new Date())) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSeason(season.id);
                      }}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              ))}
              {seasons.length === 0 && (
                <p className="text-gray-500 text-center py-4">{t('admin.seasons.noSeasons')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedSeason ? (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  {t('admin.seasons.teamsIn', { name: selectedSeason.name })}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={openTeamModal}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    {t('admin.teams.addTeam')}
                  </button>
                  <button
                    onClick={handleGenerateSchedule}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    disabled={teams.length < 2}
                  >
                    {t('admin.teams.generateSchedule')}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {teams.map(team => (
                  <div
                    key={team.id}
                    className="p-3 bg-gray-50 rounded flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">{team.name}</div>
                      <div className="text-sm text-gray-500">
                        {team._count?.players} {t('common.players')}
                        {team.manager && ` · ${t('admin.teams.managedBy', { name: team.manager.name })}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                ))}
                {teams.length === 0 && (
                  <p className="text-gray-500 text-center py-4">{t('admin.teams.noTeams')}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              {t('admin.seasons.selectSeason')}
            </div>
          )}
        </div>
      </div>

      {showModal === 'season' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">{t('admin.modal.createSeason')}</h3>
            <form onSubmit={seasonForm.handleSubmit(handleCreateSeason)}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">{t('admin.modal.name')}</label>
                <input
                  type="text"
                  {...seasonForm.register('name', { required: true })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">{t('admin.modal.sportType')}</label>
                <input
                  type="text"
                  {...seasonForm.register('sportType', { required: true })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder={t('admin.modal.sportTypePlaceholder')}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('admin.modal.startDate')}</label>
                  <input
                    type="date"
                    {...seasonForm.register('startDate', { required: true })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('admin.modal.endDate')}</label>
                  <input
                    type="date"
                    {...seasonForm.register('endDate', { required: true })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">{t('admin.modal.status')}</label>
                <select
                  {...seasonForm.register('status')}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="DRAFT">{t('seasons.status.DRAFT')}</option>
                  <option value="ACTIVE">{t('seasons.status.ACTIVE')}</option>
                  <option value="COMPLETED">{t('seasons.status.COMPLETED')}</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'team' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">{t('admin.modal.addTeam')}</h3>
            <form onSubmit={teamForm.handleSubmit(handleCreateTeam)}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">{t('admin.modal.teamName')}</label>
                <input
                  type="text"
                  {...teamForm.register('name', { required: true })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">{t('admin.modal.manager')}</label>
                <select
                  {...teamForm.register('managerId')}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">{t('admin.modal.noManager')}</option>
                  {teamManagers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {t('admin.modal.addTeam')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
