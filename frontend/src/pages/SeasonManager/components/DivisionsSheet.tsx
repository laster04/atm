import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { seasonApi } from '@/services/api';
import type { Season, SeasonGroup, Team } from '@types';
import { SEASON_ACCENT } from './util';

interface DivisionsSheetProps {
	season: Season;
	teams: Team[];
	onClose: () => void;
	/** Divisions change what the table looks like, so the caller re-reads it. */
	onChanged: () => void;
}

/**
 * Divisions inside one season, and which team plays in which.
 *
 * Deleting a division leaves its teams in the season with no division rather
 * than removing them from the competition, so the list of unplaced teams is
 * always the honest answer to "who still needs placing".
 */
export default function DivisionsSheet({ season, teams, onClose, onChanged }: DivisionsSheetProps) {
	const { t } = useTranslation();

	const [groups, setGroups] = useState<SeasonGroup[]>([]);
	const [placement, setPlacement] = useState<Record<string, string | null>>({});
	const [newName, setNewName] = useState('');
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const load = useCallback(async () => {
		try {
			const res = await seasonApi.getGroups(season.id);
			setGroups(res.data);

			const placed: Record<string, string | null> = {};
			for (const team of teams) placed[team.id] = null;
			for (const group of res.data) {
				for (const entry of group.seasonTeams ?? []) placed[entry.teamId] = group.id;
			}
			setPlacement(placed);
		} catch {
			setError(t('seasonManagement.divisions.loadError'));
		} finally {
			setLoading(false);
		}
	}, [season.id, teams, t]);

	useEffect(() => {
		void load();
	}, [load]);

	const run = async (action: () => Promise<unknown>, fallback: string) => {
		setBusy(true);
		setError('');
		try {
			await action();
			await load();
			onChanged();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t(fallback));
		} finally {
			setBusy(false);
		}
	};

	const add = () =>
		run(async () => {
			await seasonApi.createGroup(season.id, newName.trim());
			setNewName('');
		}, 'seasonManagement.divisions.createError');

	const remove = (group: SeasonGroup) =>
		run(() => seasonApi.deleteGroup(season.id, group.id), 'seasonManagement.divisions.deleteError');

	const place = (teamId: string, groupId: string | null) =>
		run(
			() => seasonApi.assignTeamToGroup(season.id, teamId, groupId),
			'seasonManagement.divisions.placeError'
		);

	const unplaced = teams.filter((team) => !placement[team.id]);

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-background">
			<div className="tm-team-header shrink-0 text-white shadow-md" style={{ backgroundColor: SEASON_ACCENT }}>
				<div className="flex items-center gap-3 px-4 py-3">
					<button
						onClick={onClose}
						className="-ml-2 flex size-10 items-center justify-center rounded-lg"
						aria-label={t('common.close')}
					>
						<X className="size-5" aria-hidden />
					</button>
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-lg font-bold">{t('seasonManagement.divisions.title')}</h1>
						<p className="truncate text-xs text-white/85">{season.name}</p>
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
				<p className="text-[12.5px] leading-snug text-muted-foreground">
					{t('seasonManagement.divisions.intro')}
				</p>

				<div className="flex gap-2">
					<input
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						placeholder={t('seasonManagement.divisions.namePlaceholder')}
						className="h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]"
					/>
					<button
						onClick={() => void add()}
						disabled={busy || !newName.trim()}
						className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] px-4 text-[14.5px] font-semibold text-white disabled:opacity-60"
						style={{ backgroundColor: SEASON_ACCENT }}
					>
						<Plus className="size-4" aria-hidden />
						{t('common.create')}
					</button>
				</div>

				{loading ? (
					<p className="text-sm text-muted-foreground">{t('common.loading')}</p>
				) : groups.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border p-6 text-center">
						<p className="text-sm text-muted-foreground">{t('seasonManagement.divisions.empty')}</p>
					</div>
				) : (
					groups.map((group) => (
						<div key={group.id} className="flex flex-col gap-2">
							<div className="flex items-center justify-between gap-2">
								<span className="tm-section-label">{group.name}</span>
								<button
									onClick={() => void remove(group)}
									disabled={busy}
									className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground disabled:opacity-60"
									aria-label={t('common.delete')}
								>
									<Trash2 className="size-4" aria-hidden />
								</button>
							</div>
							<div className="tm-rows-card">
								{teams.filter((team) => placement[team.id] === group.id).length === 0 ? (
									<div className="px-3.5 py-4 text-center text-[13px] text-muted-foreground">
										{t('seasonManagement.divisions.noTeams')}
									</div>
								) : (
									teams
										.filter((team) => placement[team.id] === group.id)
										.map((team) => (
											<div key={team.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
												<span
													className="size-2.5 shrink-0 rounded-full"
													style={{ backgroundColor: team.primaryColor || '#cbd5e1' }}
												/>
												<span className="min-w-0 flex-1 truncate text-[14.5px]">{team.name}</span>
												<button
													onClick={() => void place(team.id, null)}
													disabled={busy}
													className="shrink-0 text-[12.5px] font-semibold text-muted-foreground disabled:opacity-60"
												>
													{t('seasonManagement.divisions.remove')}
												</button>
											</div>
										))
								)}
							</div>
						</div>
					))
				)}

				{!loading && unplaced.length > 0 && groups.length > 0 && (
					<div className="flex flex-col gap-2">
						<span className="tm-section-label">{t('seasonManagement.divisions.unplaced')}</span>
						<div className="tm-rows-card">
							{unplaced.map((team) => (
								<div key={team.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
									<span
										className="size-2.5 shrink-0 rounded-full"
										style={{ backgroundColor: team.primaryColor || '#cbd5e1' }}
									/>
									<span className="min-w-0 flex-1 truncate text-[14.5px]">{team.name}</span>
									<select
										value=""
										disabled={busy}
										onChange={(e) => e.target.value && void place(team.id, e.target.value)}
										className="h-9 shrink-0 rounded-[10px] border border-border bg-input-background px-2 text-[13px]"
									>
										<option value="">{t('seasonManagement.divisions.placeIn')}</option>
										{groups.map((group) => (
											<option key={group.id} value={group.id}>
												{group.name}
											</option>
										))}
									</select>
								</div>
							))}
						</div>
					</div>
				)}

				{error && <p className="text-sm text-red-600">{error}</p>}
			</div>

			<div className="tm-save-bar shrink-0">
				<button
					onClick={onClose}
					className="h-11 flex-1 rounded-[10px] text-[15px] font-semibold text-white"
					style={{ backgroundColor: SEASON_ACCENT }}
				>
					{t('common.close')}
				</button>
			</div>
		</div>
	);
}
