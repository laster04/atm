import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { leagueApi } from '@/services/api';
import type { League, Season } from '@types';
import { VisibilityBadge } from '@/components/public';
import LeagueFormModal, { type LeagueFormData } from '@/pages/Admin/components/leagues/LeagueFormModal';
import { SEASON_ACCENT } from './util';

interface LeaguesSectionProps {
	leagues: League[];
	seasons: Season[];
	onChange: (leagues: League[]) => void;
}

/**
 * The season manager's own leagues: rename, logo, description, visibility,
 * and delete while a league has no season yet. This used to live in /admin,
 * which is now for the Admin role only.
 */
export default function LeaguesSection({ leagues, seasons, onChange }: LeaguesSectionProps) {
	const { t } = useTranslation();
	const [editing, setEditing] = useState<League | 'new' | null>(null);

	const seasonCount = (league: League) => seasons.filter((season) => season.leagueId === league.id).length;
	const fail = (error: unknown, key: string) =>
		toast.error((error as AxiosError<{ error?: string }>).response?.data?.error ?? t(key));

	const submit = async (data: LeagueFormData) => {
		const target = editing;
		setEditing(null);
		try {
			if (target === 'new') {
				const res = await leagueApi.create(data);
				onChange([...leagues, res.data]);
			} else if (target) {
				const res = await leagueApi.update(target.id, data);
				onChange(leagues.map((league) => (league.id === target.id ? { ...league, ...res.data } : league)));
			}
			toast.success(t('seasonManagement.leagues.saved'));
		} catch (error) {
			fail(error, target === 'new' ? 'admin.errors.createLeague' : 'admin.errors.updateLeague');
		}
	};

	const remove = async (league: League) => {
		if (!confirm(t('admin.confirm.deleteLeague'))) return;
		try {
			await leagueApi.delete(league.id);
			onChange(leagues.filter((row) => row.id !== league.id));
			toast.success(t('seasonManagement.leagues.deleted'));
		} catch (error) {
			fail(error, 'admin.errors.deleteLeague');
		}
	};

	return (
		<section aria-labelledby="my-leagues-title" className="mb-5 flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<h2 id="my-leagues-title" className="tm-section-label">{t('seasonManagement.leagues.title')}</h2>
				<button
					type="button"
					onClick={() => setEditing('new')}
					className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-semibold"
					style={{ color: SEASON_ACCENT }}
				>
					<Plus className="size-4" aria-hidden />
					{t('seasonManagement.leagues.new')}
				</button>
			</div>

			{leagues.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t('seasonManagement.leagues.empty')}</p>
			) : (
				<div className="tm-rows-card">
					{leagues.map((league) => {
						const count = seasonCount(league);
						return (
							<div key={league.id} className="flex items-center gap-3 px-3 py-2.5">
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="flex items-center gap-2">
										<span className="truncate text-[14.5px] font-semibold">{league.name}</span>
										<VisibilityBadge visibility={league.visibility} />
									</span>
									<span className="text-xs text-muted-foreground">
										{t(`sports.${league.sportType}`)} · {t('seasonManagement.leagues.seasons', { count })}
									</span>
								</span>
								<button
									type="button"
									onClick={() => setEditing(league)}
									className="flex size-11 items-center justify-center rounded-lg"
									aria-label={t('seasonManagement.leagues.edit', { name: league.name })}
								>
									<Pencil className="size-4" aria-hidden />
								</button>
								{/* The server refuses to delete a league that has seasons. */}
								{count === 0 && (
									<button
										type="button"
										onClick={() => remove(league)}
										className="flex size-11 items-center justify-center rounded-lg text-destructive"
										aria-label={t('seasonManagement.leagues.delete', { name: league.name })}
									>
										<Trash2 className="size-4" aria-hidden />
									</button>
								)}
							</div>
						);
					})}
				</div>
			)}

			{editing && (
				<LeagueFormModal
					league={editing === 'new' ? null : editing}
					onSubmit={submit}
					onClose={() => setEditing(null)}
				/>
			)}
		</section>
	);
}
