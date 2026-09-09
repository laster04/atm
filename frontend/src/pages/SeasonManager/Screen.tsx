import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Plus, Users } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '../../context/AuthContext';
import { leagueApi, seasonApi } from '@/services/api';
import type { League, Season } from '@types';
import SeasonFormModal, { type SeasonFormData } from '@/pages/Admin/components/seasons/SeasonFormModal';
import { SEASON_ACCENT, SEASON_STATUS_TONE, teamCount } from './components/util';

export default function Screen() {
	const { t } = useTranslation();
	const { isAdmin, isSeasonManager } = useAuth();
	const [seasons, setSeasons] = useState<Season[]>([]);
	const [leagues, setLeagues] = useState<League[]>([]);
	const [loading, setLoading] = useState(false);
	const [showForm, setShowForm] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		const scoped = isSeasonManager() && !isAdmin();
		setLoading(true);
		Promise.all([
			scoped ? seasonApi.getMySeasons() : seasonApi.getAll(),
			scoped ? leagueApi.getMyLeagues() : leagueApi.getAll(),
		])
			.then(([seasonsRes, leaguesRes]) => {
				setSeasons(seasonsRes.data);
				setLeagues(leaguesRes.data);
			})
			.catch((err) => console.error(err))
			.finally(() => setLoading(false));
	}, [isAdmin, isSeasonManager]);

	const handleCreate = async (data: SeasonFormData) => {
		setError('');
		const { copyTeamIds, ...seasonData } = data;
		try {
			const res = await seasonApi.create(seasonData);
			let created = res.data;
			if (copyTeamIds && copyTeamIds.length > 0) {
				const copyRes = await seasonApi.copyTeams(created.id, copyTeamIds);
				created = {
					...created,
					_count: {
						...created._count,
						seasonTeams: copyRes.data.teams.length,
						games: created._count?.games ?? 0,
					},
				};
			}
			setSeasons((prev) => [...prev, created]);
			setShowForm(false);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('seasonManagement.createError'));
		}
	};

	if (loading && seasons.length === 0) {
		return <div className="py-8 text-center">{t('common.loading')}</div>;
	}

	return (
		<>
			{error && <p className="mb-3 text-sm text-red-600">{error}</p>}

			{seasons.length === 0 ? (
				<div className="py-8 text-center text-muted-foreground">{t('seasonManagement.noSeasons')}</div>
			) : (
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
					{seasons.map((season) => {
						const tone = SEASON_STATUS_TONE[season.status];
						return (
							<Link
								key={season.id}
								to={`/season-management/${season.id}`}
								className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm transition-colors active:bg-muted"
							>
								<div className="flex min-w-0 flex-1 flex-col gap-1.5">
									<div className="flex items-center gap-2">
										<span className="truncate text-[15.5px] font-semibold leading-tight">
											{season.name}
										</span>
										<span
											className="tm-status-pill uppercase tracking-wide"
											style={{ backgroundColor: tone.bg, color: tone.fg }}
										>
											{t(`seasonManagement.status.${season.status}`)}
										</span>
									</div>
									{season.league && (
										<span className="truncate text-xs text-muted-foreground">{season.league.name}</span>
									)}
									<div className="flex items-center gap-3 text-xs text-muted-foreground">
										<span className="flex items-center gap-1">
											<Users className="size-3.5" aria-hidden />
											{teamCount(season)}
										</span>
										<span className="flex items-center gap-1">
											<CalendarDays className="size-3.5" aria-hidden />
											{season._count?.games ?? 0}
										</span>
									</div>
								</div>
								<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
							</Link>
						);
					})}
				</div>
			)}

			<button
				onClick={() => setShowForm(true)}
				className="tm-fab"
				style={{ backgroundColor: SEASON_ACCENT, bottom: '1.5rem' }}
			>
				<Plus className="size-5" aria-hidden />
				{t('seasonManagement.newSeason')}
			</button>

			{showForm && (
				<SeasonFormModal
					season={null}
					leagues={leagues}
					seasons={seasons}
					onSubmit={handleCreate}
					onClose={() => setShowForm(false)}
				/>
			)}
		</>
	);
}
