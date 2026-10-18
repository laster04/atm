import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { leagueApi, tournamentSeriesApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { SportType, Visibility } from '@types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog';
import VisibilityPicker from '@/components/VisibilityPicker';

export type StartKind = 'league' | 'series';

/** The sports each kind can be created with today; the same lists as the admin and tournament forms. */
const SPORTS: Record<StartKind, SportType[]> = {
	league: [SportType.HOCKEY, SportType.FLOORBALL, SportType.FOOTBALL, SportType.BASKETBALL, SportType.VOLLEYBALL, SportType.TENNIS, SportType.OTHER],
	series: [SportType.HOCKEY, SportType.TENNIS, SportType.OTHER],
};

interface CreateCompetitionDialogProps {
	kind: StartKind | null;
	onClose: () => void;
}

/**
 * Starts a league or a tournament series from the dashboard, the way in for an
 * account that manages nothing yet: the management areas only open to someone
 * who already runs something. The creator becomes its manager.
 */
export default function CreateCompetitionDialog({ kind, onClose }: CreateCompetitionDialogProps) {
	const { t } = useTranslation();
	const { refreshUser } = useAuth();
	const navigate = useNavigate();
	const [name, setName] = useState('');
	const [sport, setSport] = useState<SportType>(SportType.HOCKEY);
	const [visibility, setVisibility] = useState<Visibility>(Visibility.PUBLIC);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const close = () => {
		setName('');
		setSport(SportType.HOCKEY);
		setVisibility(Visibility.PUBLIC);
		setError('');
		onClose();
	};

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!kind || !name.trim()) return;
		setSaving(true);
		setError('');
		try {
			const data = { name: name.trim(), sportType: sport, visibility };
			const created = kind === 'league' ? await leagueApi.create(data) : await tournamentSeriesApi.create(data);
			// The new role decides which areas open, so the account is read again first.
			await refreshUser();
			close();
			navigate(kind === 'league' ? '/season-management/my-seasons' : `/tournament-management/series/${created.data.id}`);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('dashboard.start.error'));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={kind !== null} onOpenChange={(open) => !open && close()}>
			<DialogContent className="sm:max-w-lg">
				{kind && (
					<form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
						<DialogHeader>
							<DialogTitle>{t(`dashboard.start.${kind}.dialogTitle`)}</DialogTitle>
							<DialogDescription>{t(`dashboard.start.${kind}.dialogText`)}</DialogDescription>
						</DialogHeader>

						<label className="flex flex-col gap-1.5 text-sm font-medium">
							{t(`dashboard.start.${kind}.name`)}
							<input
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder={t(`dashboard.start.${kind}.namePlaceholder`)}
								maxLength={120}
								required
								autoFocus
								className="h-11 rounded-lg border border-border bg-card px-3 text-[15px] font-normal"
							/>
						</label>

						<label className="flex flex-col gap-1.5 text-sm font-medium">
							{t('dashboard.start.sport')}
							<select
								value={sport}
								onChange={(event) => setSport(event.target.value as SportType)}
								className="h-11 rounded-lg border border-border bg-card px-3 text-[15px] font-normal"
							>
								{SPORTS[kind].map((option) => (
									<option key={option} value={option}>{t(`sports.${option}`)}</option>
								))}
							</select>
						</label>

						<div className="flex flex-col gap-1.5">
							<span className="text-sm font-medium">{t('visibility.label')}</span>
							<VisibilityPicker value={visibility} onChange={setVisibility} />
						</div>

						<p className="text-[13px] text-muted-foreground">{t(`dashboard.start.${kind}.next`)}</p>
						{error && <p role="alert" className="text-sm text-destructive-strong">{error}</p>}

						<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
							<button type="button" onClick={close} className="h-11 rounded-lg border border-border px-4 text-[14px] font-semibold">
								{t('common.cancel')}
							</button>
							<button
								type="submit"
								disabled={saving || !name.trim()}
								className="h-11 rounded-lg bg-navy px-5 text-[14px] font-semibold text-white disabled:opacity-60"
							>
								{saving ? t('dashboard.start.creating') : t(`dashboard.start.${kind}.create`)}
							</button>
						</div>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
