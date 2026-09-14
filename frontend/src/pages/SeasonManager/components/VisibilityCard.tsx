import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Globe, Link2, Lock } from 'lucide-react';
import { seasonApi } from '@/services/api';
import { Visibility, type Season } from '@types';
import VisibilityPicker from '@/components/VisibilityPicker';
import { SEASON_ACCENT } from './util';

const ICON = {
	[Visibility.PUBLIC]: Globe,
	[Visibility.UNLISTED]: Link2,
	[Visibility.PRIVATE]: Lock,
};

const TONE = {
	[Visibility.PUBLIC]: { bg: '#dcfce7', fg: '#166534' },
	[Visibility.UNLISTED]: { bg: '#fef3c7', fg: '#92400e' },
	[Visibility.PRIVATE]: { bg: '#fee2e2', fg: '#991b1b' },
};

interface VisibilityCardProps {
	season: Season;
	onSeasonChange: (season: Season) => void;
}

/**
 * Who can see the season, and the publish step. A season starts unlisted, so
 * until it is published this is the card that says the draw is not out yet.
 */
export default function VisibilityCard({ season, onSeasonChange }: VisibilityCardProps) {
	const { t } = useTranslation();
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const level = season.visibility ?? Visibility.PUBLIC;
	const league = season.league?.visibility ?? Visibility.PUBLIC;
	const Icon = ICON[level];
	const tone = TONE[level];

	const save = async (visibility: Visibility) => {
		if (visibility === level) return;
		setError('');
		setSaving(true);
		try {
			const res = await seasonApi.update(season.id, { visibility });
			onSeasonChange(res.data);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('seasonManagement.visibility.error'));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<span className="tm-section-label">{t('seasonManagement.visibility.label')}</span>
			<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm">
				<div className="flex items-start gap-3">
					<span
						className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
						style={{ backgroundColor: tone.bg }}
					>
						<Icon className="size-[19px]" style={{ color: tone.fg }} aria-hidden />
					</span>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-[15px] font-semibold leading-snug">
							{t(`seasonManagement.visibility.${level}.title`)}
						</span>
						<span className="text-[12.5px] leading-snug text-muted-foreground">
							{t(`seasonManagement.visibility.${level}.hint`)}
						</span>
					</div>
					<button
						onClick={() => setEditing((open) => !open)}
						className="h-9 shrink-0 rounded-[9px] border border-border px-3 text-[12.5px] font-semibold"
					>
						{editing ? t('seasonManagement.visibility.done') : t('seasonManagement.visibility.change')}
					</button>
				</div>

				{/* A season is never more visible than its league; say so rather than
				    let "Published" suggest visitors can see it. */}
				{league !== Visibility.PUBLIC && (
					<p className="rounded-[9px] bg-muted px-3 py-2 text-[12.5px] leading-snug text-muted-foreground">
						{t(`seasonManagement.visibility.league${league}`)}
					</p>
				)}

				{editing && <VisibilityPicker value={level} onChange={save} disabled={saving} />}

				{!editing && level !== Visibility.PUBLIC && (
					<button
						onClick={() => save(Visibility.PUBLIC)}
						disabled={saving}
						className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[14.5px] font-semibold text-white disabled:opacity-60"
						style={{ backgroundColor: SEASON_ACCENT }}
					>
						<Globe className="size-4" aria-hidden />
						{t('seasonManagement.visibility.publish')}
					</button>
				)}

				{error && <p className="text-sm text-red-600">{error}</p>}
			</div>
		</div>
	);
}
