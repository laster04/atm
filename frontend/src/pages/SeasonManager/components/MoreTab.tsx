import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CalendarPlus, ExternalLink } from 'lucide-react';
import { AxiosError } from 'axios';
import { gameApi } from '@/services/api';
import type { Game, Season } from '@types';
import GenerateScheduleModal, { type GenerateScheduleData } from '@/pages/Admin/components/games/GenerateScheduleModal';
import { SEASON_ACCENT } from './util';

interface MoreTabProps {
	season: Season;
	teamCount: number;
	gameCount: number;
	onGamesChange: (games: Game[]) => void;
}

export default function MoreTab({ season, teamCount, gameCount, onGamesChange }: MoreTabProps) {
	const { t, i18n } = useTranslation();
	const [showGenerate, setShowGenerate] = useState(false);
	const [error, setError] = useState('');

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });

	const handleGenerate = async (data: GenerateScheduleData) => {
		setError('');
		try {
			await gameApi.generateSchedule(season.id, data);
			// The generate endpoint returns only the fixtures it created, without
			// the team relations the list rows render, so re-read the season.
			const res = await gameApi.getBySeason(season.id);
			onGamesChange(res.data);
			setShowGenerate(false);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('seasonManagement.more.generateError'));
		}
	};

	const info = [
		{ label: t('seasonManagement.more.league'), value: season.league?.name ?? '—' },
		{ label: t('seasonManagement.more.starts'), value: formatDate(season.startDate) },
		{ label: t('seasonManagement.more.ends'), value: formatDate(season.endDate) },
	];

	return (
		<div className="flex flex-col gap-4">
			{error && <p className="text-sm text-red-600">{error}</p>}

			<div className="flex flex-col gap-2">
				<span className="tm-section-label">{t('seasonManagement.more.seasonInfo')}</span>
				<dl className="tm-rows-card">
					{info.map((row) => (
						<div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
							<dt className="shrink-0 text-muted-foreground">{row.label}</dt>
							<dd className="min-w-0 truncate text-right font-medium">{row.value}</dd>
						</div>
					))}
				</dl>
			</div>

			<div className="flex flex-col gap-2">
				<span className="tm-section-label">{t('seasonManagement.more.actions')}</span>

				<button
					onClick={() => setShowGenerate(true)}
					disabled={teamCount < 2}
					className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left disabled:opacity-50"
				>
					<CalendarPlus className="size-5 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-sm font-semibold">{t('seasonManagement.more.generateSchedule')}</span>
						<span className="text-xs text-muted-foreground">
							{gameCount > 0
								? t('seasonManagement.more.regenerateHint')
								: t('seasonManagement.more.generateHint')}
						</span>
					</span>
				</button>

				<Link
					to={`/season-detail/${season.id}`}
					className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
				>
					<ExternalLink className="size-5 shrink-0" style={{ color: SEASON_ACCENT }} aria-hidden />
					<span className="text-sm font-semibold">{t('seasonManagement.more.publicPage')}</span>
				</Link>
			</div>

			{showGenerate && (
				<GenerateScheduleModal
					teamsCount={teamCount}
					onSubmit={handleGenerate}
					onClose={() => setShowGenerate(false)}
				/>
			)}
		</div>
	);
}
