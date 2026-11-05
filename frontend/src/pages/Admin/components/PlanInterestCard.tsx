import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '@/services/api';
import type { PlanInterestOverview } from '@types';

/** Who pressed "Mám zájem" on the Liga plan, and the ones who left a contact to interview. */
export default function PlanInterestCard() {
	const { t, i18n } = useTranslation();
	const [interest, setInterest] = useState<PlanInterestOverview | null>(null);

	useEffect(() => {
		adminApi.planInterest().then((res) => setInterest(res.data)).catch((error) => console.error(error));
	}, []);

	const number = (value: number) => value.toLocaleString(i18n.language);
	const date = (value: string) => new Date(value).toLocaleDateString(i18n.language, { timeZone: 'Europe/Prague' });

	return (
		<section aria-labelledby="plan-interest-title" className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="plan-interest-title" className="text-lg font-extrabold">{t('adminShell.overview.planInterest')}</h2>
				{interest && (
					<span className="text-sm font-semibold tabular-nums">
						{t('adminShell.overview.planInterestCounts', {
							total: number(interest.total),
							recent: number(interest.last30Days),
							contacts: number(interest.contacts),
						})}
					</span>
				)}
			</div>
			<p className="text-xs text-muted-foreground">{t('adminShell.overview.planInterestHint')}</p>
			{interest && interest.leads.length === 0 && (
				<p className="text-sm text-muted-foreground">{t('adminShell.overview.planInterestNone')}</p>
			)}
			{interest && interest.leads.length > 0 && (
				<ul className="flex flex-col divide-y divide-border">
					{interest.leads.map((lead) => {
						const email = lead.email ?? lead.user?.email ?? '';
						return (
							<li key={lead.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
								<span className="flex min-w-0 flex-col">
									<span className="truncate font-semibold">
										{lead.leagueName ?? t('adminShell.overview.planInterestNoLeague')}
										{lead.teamCount !== null && (
											<span className="font-normal text-muted-foreground"> · {t('adminShell.overview.planInterestTeams', { count: lead.teamCount })}</span>
										)}
									</span>
									{email && (
										<a href={`mailto:${email}`} className="truncate text-xs text-muted-foreground hover:underline">
											{lead.user ? `${lead.user.name} · ${email}` : email}
										</a>
									)}
								</span>
								<span className="shrink-0 tabular-nums text-muted-foreground">{date(lead.createdAt)}</span>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
