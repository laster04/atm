import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Archive, CalendarDays, ChevronRight, MoreVertical, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/context/AuthContext';
import { leagueApi, seasonApi } from '@/services/api';
import { SeasonStatus, type League, type Season } from '@types';
import { cn } from '@/components/utils';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@components/base/dropdown-menu';
import SeasonFormModal, { type SeasonFormData } from '../components/seasons/SeasonFormModal';
import { SEASON_STATUS_TONE, teamCount } from '@/pages/SeasonManager/components/util';
import { ADMIN_GOLD, ADMIN_INK } from '../components/util';

const RESET_TIMEOUT_SECONDS = 10;

/**
 * A season row here is a doorway, not an edit form: everything inside a season —
 * teams, fixtures, dates, results, the table — is managed on the season manager
 * screens. What stays is the admin's own view of the whole list: which league a
 * season belongs to, and the lifecycle actions on the season record itself.
 */
export default function SeasonsPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { isAdmin, isSeasonManager } = useAuth();
	const [searchParams] = useSearchParams();

	const [leagues, setLeagues] = useState<League[]>([]);
	const [seasons, setSeasons] = useState<Season[]>([]);
	const [leagueFilter, setLeagueFilter] = useState<string | null>(searchParams.get('leagueId'));
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [showForm, setShowForm] = useState(false);
	const [editingSeason, setEditingSeason] = useState<Season | null>(null);

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

	useEffect(() => {
		if (!error) return;
		const timeout = setTimeout(() => setError(''), RESET_TIMEOUT_SECONDS * 1000);
		return () => clearTimeout(timeout);
	}, [error]);

	const visible = useMemo(
		() => (leagueFilter ? seasons.filter((s) => s.leagueId === leagueFilter) : seasons),
		[seasons, leagueFilter]
	);

	const leagueName = (season: Season) =>
		season.league?.name ?? leagues.find((l) => l.id === season.leagueId)?.name ?? '—';

	const handleSubmit = async (data: SeasonFormData) => {
		setError('');
		const { copyTeamIds, ...seasonData } = data;
		try {
			if (editingSeason) {
				const res = await seasonApi.update(editingSeason.id, seasonData);
				setSeasons((prev) => prev.map((s) => (s.id === editingSeason.id ? res.data : s)));
			} else {
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
			}
			setShowForm(false);
			setEditingSeason(null);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(
				axiosError.response?.data?.error ||
					t(editingSeason ? 'admin.errors.updateSeason' : 'admin.errors.createSeason')
			);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm(t('admin.confirm.deleteSeason'))) return;
		try {
			await seasonApi.delete(id);
			setSeasons((prev) => prev.filter((s) => s.id !== id));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.deleteSeason'));
		}
	};

	const handleArchive = async (id: string) => {
		if (!confirm(t('admin.confirm.archiveSeason'))) return;
		try {
			const res = await seasonApi.archive(id);
			setSeasons((prev) => prev.map((s) => (s.id === id ? res.data.season : s)));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.archiveSeason'));
		}
	};

	if (loading && seasons.length === 0) {
		return <div className="py-4 text-center">{t('common.loading')}</div>;
	}

	return (
		<div className="flex flex-col gap-3">
			{error && <div className="rounded bg-red-100 p-3 text-red-700">{error}</div>}

			{leagues.length > 1 && (
				<div className="tm-pill-strip">
					<button
						className="tm-sort-pill"
						aria-pressed={leagueFilter === null}
						style={leagueFilter === null ? { backgroundColor: ADMIN_GOLD, color: ADMIN_INK } : undefined}
						onClick={() => setLeagueFilter(null)}
					>
						{t('admin.seasons.allLeagues')}
					</button>
					{leagues.map((league) => (
						<button
							key={league.id}
							className="tm-sort-pill"
							aria-pressed={leagueFilter === league.id}
							style={
								leagueFilter === league.id ? { backgroundColor: ADMIN_GOLD, color: ADMIN_INK } : undefined
							}
							onClick={() => setLeagueFilter(league.id)}
						>
							{league.name}
						</button>
					))}
				</div>
			)}

			{visible.length === 0 ? (
				<div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
					{t('admin.seasons.empty')}
				</div>
			) : (
				visible.map((season) => {
					const tone = SEASON_STATUS_TONE[season.status];
					return (
						<div
							key={season.id}
							className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm"
						>
							<button
								onClick={() => navigate(`/season-management/${season.id}`)}
								className="flex min-w-0 flex-1 items-center gap-3 text-left"
							>
								<span className="flex min-w-0 flex-1 flex-col gap-1.5">
									<span className="flex min-w-0 items-center gap-2">
										<span className="truncate text-[15.5px] font-semibold leading-tight">
											{season.name}
										</span>
										<span
											className="tm-status-pill uppercase tracking-wide"
											style={{ backgroundColor: tone.bg, color: tone.fg }}
										>
											{t(`seasonManagement.status.${season.status}`)}
										</span>
										{season.archivedAt && (
											<span className="tm-status-pill bg-muted uppercase tracking-wide text-muted-foreground">
												{t('seasons.archived')}
											</span>
										)}
									</span>
									<span className="truncate text-xs text-muted-foreground">{leagueName(season)}</span>
									<span className="flex items-center gap-3.5 text-xs text-muted-foreground">
										<span className="flex items-center gap-1">
											<Users className="size-3.5" aria-hidden />
											{teamCount(season)}
										</span>
										<span className="flex items-center gap-1">
											<CalendarDays className="size-3.5" aria-hidden />
											{season._count?.games ?? 0}
										</span>
									</span>
								</span>
								<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
							</button>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
										aria-label={t('admin.seasons.rowActions')}
									>
										<MoreVertical className="size-4" aria-hidden />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-52">
									<DropdownMenuItem
										onClick={() => {
											setEditingSeason(season);
											setShowForm(true);
										}}
									>
										<Pencil className="mr-2 size-4" />
										{t('common.edit')}
									</DropdownMenuItem>
									{season.status === SeasonStatus.COMPLETED && !season.archivedAt && (
										<DropdownMenuItem onClick={() => handleArchive(season.id)}>
											<Archive className="mr-2 size-4" />
											{t('admin.tabs.season.archiveSeason')}
										</DropdownMenuItem>
									)}
									{!season.archivedAt && (
										<DropdownMenuItem
											onClick={() => handleDelete(season.id)}
											className="text-destructive focus:text-destructive"
										>
											<Trash2 className="mr-2 size-4" />
											{t('common.delete')}
										</DropdownMenuItem>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					);
				})
			)}

			<button
				onClick={() => {
					setEditingSeason(null);
					setShowForm(true);
				}}
				className={cn('tm-fab')}
				style={{ backgroundColor: ADMIN_GOLD, color: ADMIN_INK }}
			>
				<Plus className="size-5" aria-hidden />
				{t('admin.tabs.season.addSeason')}
			</button>

			{showForm && (
				<SeasonFormModal
					season={editingSeason}
					leagues={leagues}
					seasons={seasons}
					onSubmit={handleSubmit}
					onClose={() => {
						setShowForm(false);
						setEditingSeason(null);
					}}
				/>
			)}
		</div>
	);
}
