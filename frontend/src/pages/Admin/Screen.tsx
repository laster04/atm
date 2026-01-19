import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useAppDispatch, useAppSelector } from '@/store/hooks.ts';
import { fetchSeasons, fetchMySeasons, createSeason, updateSeason, deleteSeason } from '@/store/slices/seasonsSlice.ts';
import { fetchTeamsBySeason, createTeam, updateTeam, deleteTeam } from '@/store/slices/teamsSlice.ts';
import { fetchPlayersByTeam, createPlayer, updatePlayer, deletePlayer } from '@/store/slices/playersSlice.ts';
import { fetchGamesBySeason, createGame, updateGame, deleteGame, generateSchedule } from '@/store/slices/gamesSlice.ts';
import { authApi } from '@/services/api.ts';
import { Role } from '@types';
import type { Season, User } from '@types';
import { AxiosError } from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@components/base/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/base/tabs';

import UsersTable, { type UserFilters } from './components/users/UsersTable.tsx';
import { type UserFormData } from './components/users/UserFormModal.tsx';
import SeasonsTable from './components/seasons/SeasonsTable.tsx';
import TeamsTable from './components/teams/TeamsTable.tsx';
import PlayersTable from './components/players/PlayersTable.tsx';
import GamesTable from './components/games/GamesTable.tsx';
import SeasonFormModal, { type SeasonFormData } from './components/seasons/SeasonFormModal.tsx';
import TeamFormModal, { type TeamFormData } from './components/teams/TeamFormModal.tsx';
import { type PlayerFormData } from './components/players/PlayerFormModal.tsx';
import { type GameFormData } from './components/games/GameFormModal.tsx';
import { type GenerateScheduleData } from './components/games/GenerateScheduleModal.tsx';

type ModalType = 'season' | 'team' | null;
const RESET_TIMEOUT_SECONDS = 10;

export default function AdminScreen() {
	const { isAdmin, isSeasonManager } = useAuth();
	const { t } = useTranslation();
	const dispatch = useAppDispatch();

	const { items: seasons, loading: seasonsLoading } = useAppSelector((state) => state.seasons);
	const { items: teamsBySeasonId, loading: teamsLoading } = useAppSelector((state) => state.teams);
	const { items: playersByTeamId, loading: playersLoading } = useAppSelector((state) => state.players);
	const { items: gamesBySeasonId, loading: gamesLoading } = useAppSelector((state) => state.games);

	const [users, setUsers] = useState<User[]>([]);
	const [teamManagers, setTeamManagers] = useState<User[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
	const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
	const [showModal, setShowModal] = useState<ModalType>(null);
	const [error, setError] = useState('');

	const teams = selectedSeason ? teamsBySeasonId[selectedSeason.id] || [] : [];
	const players = selectedTeamId ? playersByTeamId[selectedTeamId] || [] : [];
	const games = selectedSeason ? gamesBySeasonId[selectedSeason.id] || [] : [];

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
			dispatch(fetchGamesBySeason(selectedSeason.id));
			setSelectedTeamId(null);
		}
	}, [dispatch, selectedSeason]);

	useEffect(() => {
		if (selectedTeamId) {
			dispatch(fetchPlayersByTeam(selectedTeamId));
		}
	}, [dispatch, selectedTeamId]);

	useEffect(() => {
		if (!error) {
			return;
		}
		const timeout = setTimeout(() => {
			setError('');
		}, RESET_TIMEOUT_SECONDS * 1000);
		return () => {
			clearTimeout(timeout);
		};
	}, [error]);

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
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.createSeason'));
		}
	};

	const handleUpdateSeason = async (id: number, data: SeasonFormData) => {
		setError('');
		try {
			await dispatch(updateSeason({ id, data })).unwrap();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.updateSeason'));
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

	const handleGenerateSchedule = async (data?: GenerateScheduleData) => {
		if (!selectedSeason) return;
		setError('');
		try {
			const result = await dispatch(
				generateSchedule({
					seasonId: selectedSeason.id,
					data: {
						rounds: data?.rounds,
					},
				})
			).unwrap();
			toast.success(t('admin.tabs.game.toasts.generatedGamesSuccessTitle'), {
				description: t('admin.tabs.game.toasts.generatedGamesSuccessDescription', { count: result.games.length }),
			});
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.generateSchedule'));
		}
	};

	const handleCreateGame = async (data: GameFormData) => {
		setError('');
		try {
			if (!selectedSeason) return;
			await dispatch(
				createGame({
					seasonId: selectedSeason.id,
					data: {
						date: new Date(data.date).toISOString(),
						homeTeamId: data.homeTeamId,
						awayTeamId: data.awayTeamId,
						location: data.location || undefined,
						status: data.status,
						round: data.round || undefined,
					},
				})
			).unwrap();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.createGame'));
		}
	};

	const handleUpdateGame = async (id: number, data: GameFormData) => {
		setError('');
		try {
			await dispatch(
				updateGame({
					id,
					data: {
						date: new Date(data.date).toISOString(),
						homeTeamId: data.homeTeamId,
						awayTeamId: data.awayTeamId,
						homeScore: data.homeScore,
						awayScore: data.awayScore,
						location: data.location || undefined,
						status: data.status,
						round: data.round || undefined,
					},
				})
			).unwrap();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.updateGame'));
		}
	};

	const handleDeleteGame = async (id: number) => {
		if (!confirm(t('admin.confirm.deleteGame'))) return;
		if (!selectedSeason) return;
		try {
			await dispatch(deleteGame({ id, seasonId: selectedSeason.id })).unwrap();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.deleteGame'));
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

	const handleUpdateTeam = async (id: number, data: TeamFormData) => {
		setError('');
		try {
			await dispatch(
				updateTeam({
					id,
					data: {
						name: data.name,
						managerId: data.managerId ? parseInt(data.managerId) : null,
					},
				})
			).unwrap();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.updateTeam'));
		}
	};

	const handleCreatePlayer = async (data: PlayerFormData) => {
		setError('');
		try {
			if (!selectedTeamId) return;
			await dispatch(
				createPlayer({
					teamId: selectedTeamId,
					data: {
						name: data.name,
						number: data.number,
						position: data.position,
					},
				})
			).unwrap();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.createPlayer'));
		}
	};

	const handleUpdatePlayer = async (id: number, data: PlayerFormData) => {
		setError('');
		try {
			await dispatch(
				updatePlayer({
					id,
					data: {
						name: data.name,
						number: data.number,
						position: data.position,
					},
				})
			).unwrap();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.updatePlayer'));
		}
	};

	const handleDeletePlayer = async (id: number) => {
		if (!confirm(t('admin.confirm.deletePlayer'))) return;
		if (!selectedTeamId) return;
		try {
			await dispatch(deletePlayer({ id, teamId: selectedTeamId })).unwrap();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.deletePlayer'));
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
							<TabsTrigger value="game">{t('admin.tabs.game.title')}</TabsTrigger>
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
							<SeasonsTable
								seasons={seasons}
								onCreateSeason={handleCreateSeason}
								onUpdateSeason={handleUpdateSeason}
								onDeleteSeason={handleDeleteSeason}
							/>
						</TabsContent>
						<TabsContent value="team" className="space-y-4 mt-4">
							<TeamsTable
								teams={teams}
								seasons={seasons}
								selectedSeasonId={selectedSeason?.id || null}
								teamManagers={teamManagers}
								onSeasonChange={(seasonId) => {
									const season = seasons.find((s) => s.id === seasonId);
									if (season) setSelectedSeason(season);
								}}
								onCreateTeam={handleCreateTeam}
								onUpdateTeam={handleUpdateTeam}
								onDeleteTeam={handleDeleteTeam}
							/>
						</TabsContent>
						<TabsContent value="player" className="space-y-4 mt-4">
							<PlayersTable
								players={players}
								teams={teams}
								seasons={seasons}
								selectedSeasonId={selectedSeason?.id || null}
								selectedTeamId={selectedTeamId}
								onSeasonChange={(seasonId) => {
									const season = seasons.find((s) => s.id === seasonId);
									if (season) setSelectedSeason(season);
								}}
								onTeamChange={setSelectedTeamId}
								onCreatePlayer={handleCreatePlayer}
								onUpdatePlayer={handleUpdatePlayer}
								onDeletePlayer={handleDeletePlayer}
							/>
						</TabsContent>
						<TabsContent value="game" className="space-y-4 mt-4">
							<GamesTable
								games={games}
								teams={teams}
								seasons={seasons}
								selectedSeasonId={selectedSeason?.id || null}
								onSeasonChange={(seasonId) => {
									const season = seasons.find((s) => s.id === seasonId);
									if (season) setSelectedSeason(season);
								}}
								onCreateGame={handleCreateGame}
								onUpdateGame={handleUpdateGame}
								onDeleteGame={handleDeleteGame}
								onGenerateSchedule={handleGenerateSchedule}
							/>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>


			{showModal === 'season' && (
				<SeasonFormModal
					season={selectedSeason}
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
