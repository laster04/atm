import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useAppDispatch, useAppSelector } from '@/store/hooks.ts';
import { fetchSeasons, fetchMySeasons, createSeason, deleteSeason } from '@/store/slices/seasonsSlice.ts';
import { fetchTeamsBySeason, createTeam, deleteTeam } from '@/store/slices/teamsSlice.ts';
import { generateSchedule } from '@/store/slices/gamesSlice.ts';
import { authApi } from '@/services/api.ts';
import { Role } from '@types';
import type { Season, User } from '@types';
import { AxiosError } from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@components/base/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/base/tabs';

import UsersTable, { type UserFilters } from './components/users/UsersTable.tsx';
import { type UserFormData } from './components/users/UserFormModal.tsx';
import SeasonsTable from './components/seasons/SeasonsTable.tsx';
import SeasonsList from './components/seasons/SeasonsList.tsx';
import TeamsList from './components/teams/TeamsList.tsx';
import SeasonFormModal, { type SeasonFormData } from './components/seasons/SeasonFormModal.tsx';
import TeamFormModal, { type TeamFormData } from './components/teams/TeamFormModal.tsx';

type ModalType = 'season' | 'team' | null;

export default function AdminScreen() {
  const { isAdmin, isSeasonManager } = useAuth();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { items: seasons, loading: seasonsLoading } = useAppSelector((state) => state.seasons);
  const { items: teamsBySeasonId, loading: teamsLoading } = useAppSelector((state) => state.teams);

  const [users, setUsers] = useState<User[]>([]);
  const [teamManagers, setTeamManagers] = useState<User[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [showModal, setShowModal] = useState<ModalType>(null);
  const [error, setError] = useState('');

  const teams = selectedSeason ? teamsBySeasonId[selectedSeason.id] || [] : [];

  useEffect(() => {
    if (isSeasonManager() && !isAdmin()) {
      dispatch(fetchMySeasons());
    } else {
      dispatch(fetchSeasons());
    }

    authApi.getUsers()
      .then((res) => setUsers(res.data))
      .catch((err) => console.error(err));

    authApi.getUsers({ role: Role.TEAM_MANAGER })
      .then((res) => setTeamManagers(res.data))
      .catch((err) => console.error(err));
  }, [dispatch, isAdmin, isSeasonManager]);

  useEffect(() => {
    if (seasons.length > 0 && !selectedSeason) {
      setSelectedSeason(seasons[0]);
    }
  }, [seasons, selectedSeason]);

  useEffect(() => {
    if (selectedSeason) {
      dispatch(fetchTeamsBySeason(selectedSeason.id));
    }
  }, [dispatch, selectedSeason]);

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
      await dispatch(createSeason(data)).unwrap();
      setShowModal(null);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.createSeason'));
    }
  };

  const handleCreateTeam = async (data: TeamFormData) => {
    setError('');
    try {
      if (!selectedSeason) return;
      await dispatch(
        createTeam({
          seasonId: selectedSeason.id,
          data: {
            name: data.name,
            managerId: data.managerId ? parseInt(data.managerId) : undefined,
          },
        })
      ).unwrap();
      setShowModal(null);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.createTeam'));
    }
  };

  const handleGenerateSchedule = async () => {
    if (!selectedSeason) return;
    setError('');
    try {
      const result = await dispatch(
        generateSchedule({
          seasonId: selectedSeason.id,
          data: {
            startDate: selectedSeason.startDate,
            intervalDays: 7,
            doubleRoundRobin: true,
          },
        })
      ).unwrap();
      alert(`Generated ${result.games.length} games`);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.generateSchedule'));
    }
  };

  const handleDeleteSeason = async (id: number) => {
    if (!confirm(t('admin.confirm.deleteSeason'))) return;
    try {
      await dispatch(deleteSeason(id)).unwrap();
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
    if (!selectedSeason) return;
    try {
      await dispatch(deleteTeam({ id, seasonId: selectedSeason.id })).unwrap();
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.deleteTeam'));
    }
  };

  const canDeleteSeason = (season: Season) => {
    return isAdmin() || (isSeasonManager() && new Date(season.startDate) > new Date());
  };

  const refreshUsers = async () => {
    try {
      const [allUsers, managers] = await Promise.all([
        authApi.getUsers(),
        authApi.getUsers({ role: Role.TEAM_MANAGER })
      ]);
      setUsers(allUsers.data);
      setTeamManagers(managers.data);
    } catch (err) {
      console.error('Failed to refresh users:', err);
    }
  };

  const handleCreateUser = async (data: UserFormData) => {
    setError('');
    try {
      await authApi.createUser({
        email: data.email,
        password: data.password!,
        name: data.name,
        role: data.role,
        active: data.active
      });
      await refreshUsers();
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.createUser'));
    }
  };

  const handleUpdateUser = async (id: number, data: UserFormData) => {
    setError('');
    try {
      await authApi.updateUser(id, {
        email: data.email,
        name: data.name,
        role: data.role,
        active: data.active,
        ...(data.password ? { password: data.password } : {})
      });
      await refreshUsers();
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.updateUser'));
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm(t('admin.confirm.deleteUser'))) return;
    setError('');
    try {
      await authApi.deleteUser(id);
      await refreshUsers();
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.errors.deleteUser'));
    }
  };

  const handleFilterUsers = async (filters: UserFilters) => {
    try {
      const res = await authApi.getUsers(filters);
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to filter users:', err);
    }
  };

  if (seasonsLoading && seasons.length === 0) {
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
              <UsersTable
                users={users}
                onCreateUser={handleCreateUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
                onFilterChange={handleFilterUsers}
              />
            </TabsContent>
            <TabsContent value="season" className="space-y-4 mt-4">
              <SeasonsTable seasons={seasons} />
            </TabsContent>
            <TabsContent value="team" className="space-y-4 mt-4">
              <span>team</span>
            </TabsContent>
            <TabsContent value="player" className="space-y-4 mt-4">
              <span>player</span>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <SeasonsList
            seasons={seasons}
            selectedSeason={selectedSeason}
            onSelectSeason={setSelectedSeason}
            onDeleteSeason={handleDeleteSeason}
            onCreateSeason={() => setShowModal('season')}
            canDelete={canDeleteSeason}
          />
        </div>

        <div className="lg:col-span-2">
          {selectedSeason ? (
            <TeamsList
              season={selectedSeason}
              teams={teams}
              onAddTeam={() => setShowModal('team')}
              onGenerateSchedule={handleGenerateSchedule}
              onDeleteTeam={handleDeleteTeam}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              {t('admin.seasons.selectSeason')}
            </div>
          )}
        </div>
      </div>

      {showModal === 'season' && (
        <SeasonFormModal
          onSubmit={handleCreateSeason}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === 'team' && (
        <TeamFormModal
          teamManagers={teamManagers}
          onSubmit={handleCreateTeam}
          onClose={() => setShowModal(null)}
        />
      )}
    </div>
  );
}
