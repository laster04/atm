import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { seasonApi, teamApi, gameApi } from '@/services/api';
import { toISOString } from '@/utils/date';
import type { Season, Team, Game } from '@types';
import { AxiosError } from 'axios';
import GamesTable from '../components/games/GamesTable';
import { type GameFormData } from '../components/games/GameFormModal';
import { type GenerateScheduleData } from '../components/games/GenerateScheduleModal';

const RESET_TIMEOUT_SECONDS = 10;

export default function GamesPage() {
	const { t } = useTranslation();
	const [searchParams] = useSearchParams();
	const { isAdmin, isSeasonManager } = useAuth();

	const [seasons, setSeasons] = useState<Season[]>([]);
	const [teamsBySeason, setTeamsBySeason] = useState<Record<number, Team[]>>({});
	const [gamesBySeason, setGamesBySeason] = useState<Record<number, Game[]>>({});
	const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
	const [error, setError] = useState('');

	const teams = selectedSeason ? teamsBySeason[selectedSeason.id] || [] : [];
	const games = selectedSeason ? gamesBySeason[selectedSeason.id] || [] : [];

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
		if (selectedSeason) {
			const fetchSeasonData = async () => {
				try {
					const [teamsRes, gamesRes] = await Promise.all([
						teamApi.getBySeason(selectedSeason.id),
						gameApi.getBySeason(selectedSeason.id)
					]);
					setTeamsBySeason((prev) => ({ ...prev, [selectedSeason.id]: teamsRes.data }));
					setGamesBySeason((prev) => ({ ...prev, [selectedSeason.id]: gamesRes.data }));
				} catch (err) {
					console.error(err);
				}
			};
			fetchSeasonData();
		}
	}, [selectedSeason]);

	useEffect(() => {
		if (!error) return;
		const timeout = setTimeout(() => {
			setError('');
		}, RESET_TIMEOUT_SECONDS * 1000);
		return () => clearTimeout(timeout);
	}, [error]);

	const handleGenerateSchedule = async (data?: GenerateScheduleData) => {
		if (!selectedSeason) return;
		setError('');
		try {
			const result = await gameApi.generateSchedule(selectedSeason.id, {
				rounds: data?.rounds ?? 1,
			});
			setGamesBySeason((prev) => ({
				...prev,
				[selectedSeason.id]: [...(prev[selectedSeason.id] || []), ...result.data.games]
			}));
			toast.success(t('admin.tabs.game.toasts.generatedGamesSuccessTitle'), {
				description: t('admin.tabs.game.toasts.generatedGamesSuccessDescription', { count: result.data.games.length }),
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
			const res = await gameApi.create(selectedSeason.id, {
				date: toISOString(data.date),
				homeTeamId: data.homeTeamId,
				awayTeamId: data.awayTeamId,
				location: data.location || undefined,
				status: data.status,
				round: data.round || undefined,
			});
			setGamesBySeason((prev) => ({
				...prev,
				[selectedSeason.id]: [...(prev[selectedSeason.id] || []), res.data]
			}));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.createGame'));
		}
	};

	const handleUpdateGame = async (id: number, data: GameFormData) => {
		setError('');
		try {
			const res = await gameApi.update(id, {
				date: toISOString(data.date),
				homeTeamId: data.homeTeamId,
				awayTeamId: data.awayTeamId,
				homeScore: data.homeScore,
				awayScore: data.awayScore,
				location: data.location || undefined,
				status: data.status,
				round: data.round || undefined,
			});
			if (selectedSeason) {
				setGamesBySeason((prev) => ({
					...prev,
					[selectedSeason.id]: (prev[selectedSeason.id] || []).map((g) =>
						g.id === id ? res.data : g
					)
				}));
			}
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.updateGame'));
		}
	};

	const handleDeleteGame = async (id: number) => {
		if (!confirm(t('admin.confirm.deleteGame'))) return;
		if (!selectedSeason) return;
		try {
			await gameApi.delete(id);
			setGamesBySeason((prev) => ({
				...prev,
				[selectedSeason.id]: (prev[selectedSeason.id] || []).filter((g) => g.id !== id)
			}));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.deleteGame'));
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
			<GamesTable
				games={games}
				teams={teams}
				seasons={seasons}
				selectedSeasonId={selectedSeason?.id || null}
				onSeasonChange={handleSeasonChange}
				onCreateGame={handleCreateGame}
				onUpdateGame={handleUpdateGame}
				onDeleteGame={handleDeleteGame}
				onGenerateSchedule={handleGenerateSchedule}
			/>
		</div>
	);
}
