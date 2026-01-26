import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { seasonApi, teamApi, playerApi } from '@/services/api';
import type { Season, Team, Player } from '@types';
import { AxiosError } from 'axios';
import PlayersTable from '../components/players/PlayersTable';
import { type PlayerFormData } from '../components/players/PlayerFormModal';

const RESET_TIMEOUT_SECONDS = 10;

export default function PlayersPage() {
	const { t } = useTranslation();
	const { isAdmin, isSeasonManager } = useAuth();

	const [seasons, setSeasons] = useState<Season[]>([]);
	const [teamsBySeason, setTeamsBySeason] = useState<Record<number, Team[]>>({});
	const [playersByTeam, setPlayersByTeam] = useState<Record<number, Player[]>>({});
	const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
	const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
	const [error, setError] = useState('');

	const teams = selectedSeason ? teamsBySeason[selectedSeason.id] || [] : [];
	const players = selectedTeamId ? playersByTeam[selectedTeamId] || [] : [];

	useEffect(() => {
		const fetchSeasons = async () => {
			try {
				const res = isSeasonManager() && !isAdmin()
					? await seasonApi.getMySeasons()
					: await seasonApi.getAll();
				setSeasons(res.data);
			} catch (err) {
				console.error(err);
			}
		};
		fetchSeasons();
	}, [isAdmin, isSeasonManager]);

	useEffect(() => {
		if (seasons.length > 0 && !selectedSeason) {
			setSelectedSeason(seasons[0]);
		}
	}, [seasons, selectedSeason]);

	useEffect(() => {
		if (selectedSeason && !teamsBySeason[selectedSeason.id]) {
			teamApi.getBySeason(selectedSeason.id)
				.then((res) => {
					setTeamsBySeason((prev) => ({ ...prev, [selectedSeason.id]: res.data }));
				})
				.catch((err) => console.error(err));
			setSelectedTeamId(null);
		}
	}, [selectedSeason, teamsBySeason]);

	useEffect(() => {
		if (selectedTeamId && !playersByTeam[selectedTeamId]) {
			playerApi.getByTeam(selectedTeamId)
				.then((res) => {
					setPlayersByTeam((prev) => ({ ...prev, [selectedTeamId]: res.data }));
				})
				.catch((err) => console.error(err));
		}
	}, [selectedTeamId, playersByTeam]);

	useEffect(() => {
		if (!error) return;
		const timeout = setTimeout(() => {
			setError('');
		}, RESET_TIMEOUT_SECONDS * 1000);
		return () => clearTimeout(timeout);
	}, [error]);

	const handleCreatePlayer = async (data: PlayerFormData) => {
		setError('');
		try {
			if (!selectedTeamId) return;
			const res = await playerApi.create(selectedTeamId, {
				name: data.name,
				number: data.number,
				position: data.position,
				bornYear: data.bornYear,
				note: data.note,
			});
			setPlayersByTeam((prev) => ({
				...prev,
				[selectedTeamId]: [...(prev[selectedTeamId] || []), res.data]
			}));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.createPlayer'));
		}
	};

	const handleUpdatePlayer = async (id: number, data: PlayerFormData) => {
		setError('');
		try {
			const res = await playerApi.update(id, {
				name: data.name,
				number: data.number,
				position: data.position,
				bornYear: data.bornYear,
				note: data.note,
			});
			if (selectedTeamId) {
				setPlayersByTeam((prev) => ({
					...prev,
					[selectedTeamId]: (prev[selectedTeamId] || []).map((p) =>
						p.id === id ? res.data : p
					)
				}));
			}
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.updatePlayer'));
		}
	};

	const handleDeletePlayer = async (id: number) => {
		if (!confirm(t('admin.confirm.deletePlayer'))) return;
		if (!selectedTeamId) return;
		try {
			await playerApi.delete(id);
			setPlayersByTeam((prev) => ({
				...prev,
				[selectedTeamId]: (prev[selectedTeamId] || []).filter((p) => p.id !== id)
			}));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.deletePlayer'));
		}
	};

	const handleSeasonChange = (seasonId: number) => {
		const season = seasons.find((s) => s.id === seasonId);
		if (season) {
			setSelectedSeason(season);
			setSelectedTeamId(null);
		}
	};

	return (
		<div className="space-y-4">
			{error && (
				<div className="bg-red-100 text-red-700 p-3 rounded">
					{error}
				</div>
			)}
			<PlayersTable
				players={players}
				teams={teams}
				seasons={seasons}
				selectedSeasonId={selectedSeason?.id || null}
				selectedTeamId={selectedTeamId}
				onSeasonChange={handleSeasonChange}
				onTeamChange={setSelectedTeamId}
				onCreatePlayer={handleCreatePlayer}
				onUpdatePlayer={handleUpdatePlayer}
				onDeletePlayer={handleDeletePlayer}
			/>
		</div>
	);
}
