import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { leagueApi, seasonApi } from '@/services/api';
import { AxiosError } from 'axios';
import type { League, Season } from '@types';
import SeasonsTable from '../components/seasons/SeasonsTable';
import { type SeasonFormData } from '../components/seasons/SeasonFormModal';

const RESET_TIMEOUT_SECONDS = 10;

export default function SeasonsPage() {
	const { t } = useTranslation();
	const { isAdmin, isSeasonManager } = useAuth();
	const [leagues, setLeagues] = useState<League[]>([]);
	const [seasons, setSeasons] = useState<Season[]>([]);
	const [seasonsLoading, setSeasonsLoading] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		const fetchData = async () => {
			setSeasonsLoading(true);
			try {
				if (isSeasonManager() && !isAdmin()) {
					const [leaguesRes, seasonsRes] = await Promise.all([
						leagueApi.getMyLeagues(),
						seasonApi.getMySeasons()
					]);
					setLeagues(leaguesRes.data);
					setSeasons(seasonsRes.data);
				} else {
					const [leaguesRes, seasonsRes] = await Promise.all([
						leagueApi.getAll(),
						seasonApi.getAll()
					]);
					setLeagues(leaguesRes.data);
					setSeasons(seasonsRes.data);
				}
			} catch (err) {
				console.error(err);
			} finally {
				setSeasonsLoading(false);
			}
		};
		fetchData();
	}, [isAdmin, isSeasonManager]);

	useEffect(() => {
		if (!error) return;
		const timeout = setTimeout(() => {
			setError('');
		}, RESET_TIMEOUT_SECONDS * 1000);
		return () => clearTimeout(timeout);
	}, [error]);

	const handleCreateSeason = async (data: SeasonFormData) => {
		setError('');
		try {
			const res = await seasonApi.create(data);
			setSeasons((prev) => [...prev, res.data]);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.createSeason'));
		}
	};

	const handleUpdateSeason = async (id: number, data: SeasonFormData) => {
		setError('');
		try {
			const res = await seasonApi.update(id, data);
			setSeasons((prev) => prev.map((s) => (s.id === id ? res.data : s)));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.updateSeason'));
		}
	};

	const handleDeleteSeason = async (id: number) => {
		if (!confirm(t('admin.confirm.deleteSeason'))) return;
		try {
			await seasonApi.delete(id);
			setSeasons((prev) => prev.filter((s) => s.id !== id));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.deleteSeason'));
		}
	};

	if (seasonsLoading && seasons.length === 0) {
		return (
			<div className="text-center py-4">
				{t('common.loading')}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{error && (
				<div className="bg-red-100 text-red-700 p-3 rounded">
					{error}
				</div>
			)}
			<SeasonsTable
				seasons={seasons}
				leagues={leagues}
				onCreateSeason={handleCreateSeason}
				onUpdateSeason={handleUpdateSeason}
				onDeleteSeason={handleDeleteSeason}
			/>
		</div>
	);
}
