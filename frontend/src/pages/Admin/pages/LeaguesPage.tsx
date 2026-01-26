import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { leagueApi } from '@/services/api';
import { AxiosError } from 'axios';
import type { League } from '@types';
import LeaguesTable from '../components/leagues/LeaguesTable';
import { type LeagueFormData } from '../components/leagues/LeagueFormModal';

const RESET_TIMEOUT_SECONDS = 10;

export default function LeaguesPage() {
	const { t } = useTranslation();
	const { isAdmin, isSeasonManager } = useAuth();
	const [leagues, setLeagues] = useState<League[]>([]);
	const [error, setError] = useState('');

	useEffect(() => {
		const fetchLeagues = async () => {
			try {
				if (isSeasonManager() && !isAdmin()) {

					const res = await leagueApi.getMyLeagues();
					setLeagues(res.data);
				} else {
					const res = await leagueApi.getAll();
					setLeagues(res.data);
				}
			} catch (err) {
				console.error(err);
			}
		};
		fetchLeagues();
	}, [isAdmin, isSeasonManager]);

	useEffect(() => {
		if (!error) return;
		const timeout = setTimeout(() => {
			setError('');
		}, RESET_TIMEOUT_SECONDS * 1000);
		return () => clearTimeout(timeout);
	}, [error]);

	const handleCreateLeague = async (data: LeagueFormData) => {
		setError('');
		try {
			const res = await leagueApi.create(data);
			setLeagues((prev) => [...prev, res.data]);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.createLeague'));
		}
	};

	const handleUpdateLeague = async (id: number, data: LeagueFormData) => {
		setError('');
		try {
			const res = await leagueApi.update(id, data);
			setLeagues((prev) => prev.map((l) => (l.id === id ? res.data : l)));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.updateLeague'));
		}
	};

	const handleDeleteLeague = async (id: number) => {
		if (!confirm(t('admin.confirm.deleteLeague'))) return;
		try {
			await leagueApi.delete(id);
			setLeagues((prev) => prev.filter((l) => l.id !== id));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.deleteLeague'));
		}
	};

	return (
		<div className="space-y-4">
			{error && (
				<div className="bg-red-100 text-red-700 p-3 rounded">
					{error}
				</div>
			)}
			<LeaguesTable
				leagues={leagues}
				onCreateLeague={handleCreateLeague}
				onUpdateLeague={handleUpdateLeague}
				onDeleteLeague={handleDeleteLeague}
			/>
		</div>
	);
}
