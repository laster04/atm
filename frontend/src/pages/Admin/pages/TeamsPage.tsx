import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { authApi, seasonApi, teamApi } from '@/services/api';
import { Role } from '@types';
import type { Season, Team, User } from '@types';
import { AxiosError } from 'axios';
import TeamsTable from '../components/teams/TeamsTable';
import { type TeamFormData } from '../components/teams/TeamFormModal';

const RESET_TIMEOUT_SECONDS = 10;

export default function TeamsPage() {
	const { t } = useTranslation();
	const [searchParams] = useSearchParams();
	const { isAdmin, isSeasonManager } = useAuth();

	const [seasons, setSeasons] = useState<Season[]>([]);
	const [teamsBySeason, setTeamsBySeason] = useState<Record<number, Team[]>>({});
	const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
	const [teamManagers, setTeamManagers] = useState<User[]>([]);
	const [error, setError] = useState('');

	const teams = selectedSeason ? teamsBySeason[selectedSeason.id] || [] : [];

	useEffect(() => {
		const fetchData = async () => {
			try {
				const seasonsRes = isSeasonManager() && !isAdmin()
					? await seasonApi.getMySeasons()
					: await seasonApi.getAll();
				setSeasons(seasonsRes.data);

				const managersRes = await authApi.getUsers({ role: Role.TEAM_MANAGER });
				setTeamManagers(managersRes.data);
			} catch (err) {
				console.error(err);
			}
		};
		fetchData();
	}, [isAdmin, isSeasonManager]);

	useEffect(() => {
		if (seasons.length > 0 && !selectedSeason) {
			const seasonIdParam = searchParams.get('seasonId');
			if (seasonIdParam) {
				const season = seasons.find((s) => s.id === parseInt(seasonIdParam));
				if (season) {
					setSelectedSeason(season);
					return;
				}
			}
			setSelectedSeason(seasons[0]);
		}
	}, [seasons, selectedSeason, searchParams]);

	useEffect(() => {
		if (selectedSeason && !teamsBySeason[selectedSeason.id]) {
			teamApi.getBySeason(selectedSeason.id)
				.then((res) => {
					setTeamsBySeason((prev) => ({ ...prev, [selectedSeason.id]: res.data }));
				})
				.catch((err) => console.error(err));
		}
	}, [selectedSeason, teamsBySeason]);

	useEffect(() => {
		if (!error) return;
		const timeout = setTimeout(() => {
			setError('');
		}, RESET_TIMEOUT_SECONDS * 1000);
		return () => clearTimeout(timeout);
	}, [error]);

	const handleCreateTeam = async (data: TeamFormData) => {
		setError('');
		try {
			if (!selectedSeason) return;
			const res = await teamApi.create(selectedSeason.id, {
				name: data.name,
				managerId: data.managerId ? parseInt(data.managerId) : undefined,
			});
			setTeamsBySeason((prev) => ({
				...prev,
				[selectedSeason.id]: [...(prev[selectedSeason.id] || []), res.data]
			}));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.createTeam'));
		}
	};

	const handleUpdateTeam = async (id: number, data: TeamFormData) => {
		setError('');
		try {
			const res = await teamApi.update(id, {
				name: data.name,
				managerId: data.managerId ? parseInt(data.managerId) : null,
			});
			if (selectedSeason) {
				setTeamsBySeason((prev) => ({
					...prev,
					[selectedSeason.id]: (prev[selectedSeason.id] || []).map((t) =>
						t.id === id ? res.data : t
					)
				}));
			}
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.updateTeam'));
		}
	};

	const handleDeleteTeam = async (id: number) => {
		if (!confirm(t('admin.confirm.deleteTeam'))) return;
		if (!selectedSeason) return;
		try {
			await teamApi.delete(id);
			setTeamsBySeason((prev) => ({
				...prev,
				[selectedSeason.id]: (prev[selectedSeason.id] || []).filter((t) => t.id !== id)
			}));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.deleteTeam'));
		}
	};

	const handleSeasonChange = (seasonId: number) => {
		const season = seasons.find((s) => s.id === seasonId);
		if (season) setSelectedSeason(season);
	};

	return (
		<div className="space-y-4">
			{error && (
				<div className="bg-red-100 text-red-700 p-3 rounded">
					{error}
				</div>
			)}
			<TeamsTable
				teams={teams}
				seasons={seasons}
				selectedSeasonId={selectedSeason?.id || null}
				teamManagers={teamManagers}
				onSeasonChange={handleSeasonChange}
				onCreateTeam={handleCreateTeam}
				onUpdateTeam={handleUpdateTeam}
				onDeleteTeam={handleDeleteTeam}
			/>
		</div>
	);
}
