import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import type { League, LeaguePlanBand, LeaguePlanView } from '@types';
import { adminApi, leagueApi } from '@/services/api';
import { formatSeasonDate } from '@/utils/date';
import { Button } from '@components/base/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/base/dialog';

interface LeaguePlanAdminDialogProps {
	league: League | null;
	onClose: () => void;
}

const field = 'h-10 w-full rounded-lg border border-border bg-card px-3 text-sm';
const label = 'flex flex-col gap-1 text-[13px] font-semibold';

/** End of the chosen day in Prague, as the server stores a free-until date. */
const endOfDay = (day: string) => new Date(`${day}T23:59:59+01:00`).toISOString();

/**
 * An admin's tools for one league's plan: a free-until date (a waiver or a
 * founding deal), or a League plan granted without a payment. Both go to the
 * audit log with the reason.
 */
export default function LeaguePlanAdminDialog({ league, onClose }: LeaguePlanAdminDialogProps) {
	const { t, i18n } = useTranslation();
	const [view, setView] = useState<LeaguePlanView | null>(null);
	const [freeUntil, setFreeUntil] = useState('');
	const [band, setBand] = useState<LeaguePlanBand>('SMALL');
	const [until, setUntil] = useState('');
	const [reason, setReason] = useState('');
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!league) return;
		setView(null);
		setReason('');
		setUntil('');
		leagueApi.getPlan(league.id).then((res) => {
			setView(res.data);
			setFreeUntil(res.data.freeUntil ? res.data.freeUntil.slice(0, 10) : '');
		}).catch(() => setView(null));
	}, [league]);

	const send = async (data: Parameters<typeof adminApi.setLeaguePlan>[1]) => {
		if (!league) return;
		setBusy(true);
		try {
			const res = await adminApi.setLeaguePlan(league.id, { ...data, reason: reason.trim() || undefined });
			setView(res.data);
			toast.success(t('adminShell.leaguePlan.saved'));
		} catch (error) {
			toast.error((error as AxiosError<{ error?: string }>).response?.data?.error ?? t('adminShell.pricing.saveError'));
		} finally {
			setBusy(false);
		}
	};

	const date = (value: string) => formatSeasonDate(value, i18n.language);

	return (
		<Dialog open={!!league} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{t('adminShell.leaguePlan.title', { name: league?.name ?? '' })}</DialogTitle>
				</DialogHeader>
				{!view ? (
					<p className="text-sm text-muted-foreground">{t('common.loading')}</p>
				) : (
					<div className="flex flex-col gap-5">
						<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
							<dt className="text-muted-foreground">{t('adminShell.leaguePlan.current')}</dt>
							<dd className="font-semibold">
								{view.plan
									? t('leaguePlan.status.LEAGUE', { date: date(view.plan.until) }) + ` · ${t(`plans.names.LEAGUE_${view.plan.band}`)}`
									: view.freeUntil
										? t('leaguePlan.status.FREE_UNTIL', { date: date(view.freeUntil) })
										: '—'}
							</dd>
							<dt className="text-muted-foreground">{t('adminShell.leaguePlan.waiting')}</dt>
							<dd className="font-semibold">{view.waitingSeasons.map((season) => season.name).join(', ') || '—'}</dd>
						</dl>

						<label className={label}>
							{t('adminShell.leaguePlan.reason')}
							<input className={field} value={reason} onChange={(event) => setReason(event.target.value)} />
						</label>

						<fieldset className="flex flex-col gap-2 rounded-lg border p-3">
							<legend className="px-1 text-[13px] font-bold">{t('adminShell.leaguePlan.freeUntil')}</legend>
							<p className="text-xs text-muted-foreground">{t('adminShell.leaguePlan.freeUntilHint')}</p>
							<div className="flex gap-2">
								<input type="date" className={field} value={freeUntil} onChange={(event) => setFreeUntil(event.target.value)} />
								<Button disabled={busy} onClick={() => void send({ freeUntil: freeUntil ? endOfDay(freeUntil) : null })}>
									{t('adminShell.leaguePlan.save')}
								</Button>
							</div>
						</fieldset>

						<fieldset className="flex flex-col gap-2 rounded-lg border p-3">
							<legend className="px-1 text-[13px] font-bold">{t('adminShell.leaguePlan.grant')}</legend>
							<p className="text-xs text-muted-foreground">{t('adminShell.leaguePlan.grantHint')}</p>
							<div className="flex flex-wrap gap-2">
								<select className={`${field} w-auto`} value={band} onChange={(event) => setBand(event.target.value as LeaguePlanBand)}>
									<option value="SMALL">{t('plans.names.LEAGUE_SMALL')}</option>
									<option value="LARGE">{t('plans.names.LEAGUE_LARGE')}</option>
								</select>
								<input type="date" className={`${field} w-auto flex-1`} value={until} aria-label={t('adminShell.leaguePlan.until')} onChange={(event) => setUntil(event.target.value)} />
								<Button disabled={busy || !until || !reason.trim()} onClick={() => void send({ grant: { band, until: endOfDay(until) } })}>
									{t('adminShell.leaguePlan.grantAction')}
								</Button>
							</div>
						</fieldset>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
