import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Inbox, LifeBuoy, Receipt } from 'lucide-react';
import { adminApi } from '@/services/api';
import type { AdminOverview } from '@types';
import RegistrationFunnelCard from '../components/RegistrationFunnelCard';
import EmbedUsageCard from '../components/EmbedUsageCard';
import { ADMIN_GOLD_INK } from '../components/util';

/** What waits for an admin, first thing after signing in. */
export default function OverviewPage() {
	const { t, i18n } = useTranslation();
	const [overview, setOverview] = useState<AdminOverview | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		adminApi.overview()
			.then((res) => setOverview(res.data))
			.catch((error) => {
				console.error(error);
				setFailed(true);
			});
	}, []);

	const number = (value: number) => value.toLocaleString(i18n.language);

	if (failed) return <p className="text-sm text-destructive">{t('adminShell.list.loadError')}</p>;

	return (
		<div className="flex flex-col gap-6">
			<section aria-labelledby="queues-title" className="flex flex-col gap-2.5">
				<h2 id="queues-title" className="text-lg font-extrabold">{t('adminShell.overview.waiting')}</h2>
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					<Queue
						icon={<Receipt className="size-5" aria-hidden />}
						title={t('adminShell.overview.payments')}
						value={overview ? number(overview.queues.payments) : '…'}
						hint={t('adminShell.overview.paymentsHint')}
						to="/admin/payments?status=PENDING"
					/>
					<Queue
						icon={<LifeBuoy className="size-5" aria-hidden />}
						title={t('adminShell.overview.tickets')}
						value={overview ? number(overview.queues.openTickets) : '…'}
						hint={t('adminShell.overview.ticketsHint')}
						to="/admin/support"
					/>
					<Queue
						icon={<Inbox className="size-5" aria-hidden />}
						title={t('adminShell.overview.registrations')}
						value={overview ? number(overview.queues.staleRegistrations) : '…'}
						hint={t('adminShell.overview.registrationsHint')}
					/>
				</div>
			</section>

			<section aria-labelledby="numbers-title" className="flex flex-col gap-2.5">
				<h2 id="numbers-title" className="text-lg font-extrabold">{t('adminShell.overview.last30Days')}</h2>
				<dl className="grid gap-3 sm:grid-cols-3">
					{([
						['newUsers', overview?.last30Days.newUsers],
						['activeLeagues', overview?.last30Days.activeLeagues],
						['activeTournaments', overview?.last30Days.activeTournaments],
					] as const).map(([key, value]) => (
						<div key={key} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
							<dt className="text-[13px] font-semibold text-muted-foreground">{t(`adminShell.overview.${key}`)}</dt>
							<dd className="m-0 text-3xl font-extrabold tabular-nums">{value === undefined ? '…' : number(value)}</dd>
						</div>
					))}
				</dl>
				<p className="text-xs text-muted-foreground">{t('adminShell.overview.activeHint')}</p>
			</section>

			<RegistrationFunnelCard />
			<EmbedUsageCard />
		</div>
	);
}

function Queue({ icon, title, value, hint, to }: { icon: ReactNode; title: string; value: string | null; hint: string; to?: string }) {
	const body = (
		<>
			<span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#FFF8E1]" style={{ color: ADMIN_GOLD_INK }}>{icon}</span>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="text-[14.5px] font-semibold">{title}</span>
				<span className="text-xs leading-snug text-muted-foreground">{hint}</span>
			</span>
			{value !== null && <span className="text-2xl font-extrabold tabular-nums">{value}</span>}
			{to && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
		</>
	);
	const className = 'flex items-center gap-3 rounded-xl border border-border bg-card p-4';
	return to ? <Link to={to} className={`${className} hover:bg-muted`}>{body}</Link> : <div className={className}>{body}</div>;
}
