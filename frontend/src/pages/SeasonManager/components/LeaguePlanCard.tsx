import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Clock, Gift } from 'lucide-react';
import type { LeaguePlanView, Season } from '@types';
import { leagueApi, seasonApi } from '@/services/api';
import { formatSeasonDate } from '@/utils/date';
import LeaguePlanDialog from './LeaguePlanDialog';
import { SEASON_ACCENT } from './util';

interface LeaguePlanCardProps {
	season: Season;
	onSeasonChange: (season: Season) => void;
}

/**
 * How this season is paid for. Nothing shows while the paywall is off and the
 * season is free; a season waiting for the League plan says what waits on it
 * and opens the plan's QR payment.
 */
export default function LeaguePlanCard({ season, onSeasonChange }: LeaguePlanCardProps) {
	const { t, i18n } = useTranslation();
	const [view, setView] = useState<LeaguePlanView | null>(null);
	const [open, setOpen] = useState(false);
	const plan = season.plan ?? 'FREE';

	const load = useCallback(() => {
		leagueApi.getPlan(season.leagueId).then((res) => setView(res.data)).catch(() => setView(null));
	}, [season.leagueId]);

	useEffect(load, [load]);

	// After a payment changes, the season may have been covered meanwhile.
	const refresh = () => {
		load();
		seasonApi.getById(season.id).then((res) => onSeasonChange({ ...season, ...res.data, league: season.league })).catch(() => undefined);
	};

	if (!view || (!view.enabled && plan === 'FREE')) return null;

	const date = (value: string) => formatSeasonDate(value, i18n.language);
	const waiting = plan === 'UNPAID';
	const status = waiting
		? t('leaguePlan.status.UNPAID')
		: plan === 'LEAGUE' && view.plan
			? t('leaguePlan.status.LEAGUE', { date: date(view.plan.until) })
			: plan === 'FREE' && view.freeUntil
				? t('leaguePlan.status.FREE_UNTIL', { date: date(view.freeUntil) })
				: t(`leaguePlan.status.${plan}`);
	const Icon = waiting ? Clock : plan === 'LEAGUE' ? BadgeCheck : Gift;
	const action = view.payment
		? t('leaguePlan.showPayment')
		: waiting
			? t('leaguePlan.choose')
			: view.offers.some((offer) => offer.kind === 'RENEWAL')
				? t('leaguePlan.renew')
				: view.offers.some((offer) => offer.kind === 'UPGRADE')
					? t('leaguePlan.upgrade')
					: null;

	return (
		<div className="flex flex-col gap-2">
			<span className="tm-section-label">{t('leaguePlan.label')}</span>
			<div className={`flex flex-col gap-3 rounded-xl border bg-card p-3.5 shadow-sm ${waiting ? 'border-amber-300' : 'border-border'}`}>
				<div className="flex items-start gap-3">
					<span
						className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
						style={{ backgroundColor: waiting ? '#fef3c7' : '#dcfce7' }}
					>
						<Icon className="size-[19px]" style={{ color: waiting ? '#92400e' : '#166534' }} aria-hidden />
					</span>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-[15px] font-semibold leading-snug">{status}</span>
						<span className="text-[12.5px] leading-snug text-muted-foreground">
							{view.payment ? t('leaguePlan.awaiting') : t(`leaguePlan.hint.${plan}`)}
						</span>
					</div>
				</div>

				{waiting && (
					<ul className="list-disc space-y-0.5 rounded-[9px] bg-muted py-2 pl-7 pr-3 text-[12.5px] leading-snug text-muted-foreground">
						<li>{t('leaguePlan.blocked.public')}</li>
						<li>{t('leaguePlan.blocked.emails')}</li>
						<li>{t('leaguePlan.blocked.confirm')}</li>
					</ul>
				)}

				{action && view.enabled && (
					<button
						onClick={() => setOpen(true)}
						className="flex h-11 items-center justify-center rounded-[10px] text-[14.5px] font-semibold text-white"
						style={{ backgroundColor: SEASON_ACCENT }}
					>
						{action}
					</button>
				)}
			</div>
			<LeaguePlanDialog
				leagueId={season.leagueId}
				view={view}
				open={open}
				onOpenChange={setOpen}
				onChanged={refresh}
			/>
		</div>
	);
}
