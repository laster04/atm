import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check } from 'lucide-react';
import { billingApi } from '@/services/api';
import { formatMoney } from '@/utils/money';
import type { PlanName, PublicPlanPrice } from '@types';

/** Features of Turnaj Plus that arrive with celek C; listed, but marked as coming. */
const COMING: Partial<Record<PlanName, string[]>> = {
	TOURNAMENT_PLUS: ['sponsors', 'documents', 'branding'],
};

/**
 * The tournament price list, read from the server so it always shows what
 * the admin has set. Leagues have no price yet, so they are only mentioned.
 */
export default function PricingSection({ signedIn }: { signedIn: boolean }) {
	const { t, i18n } = useTranslation();
	const [plans, setPlans] = useState<PublicPlanPrice[] | null>(null);

	useEffect(() => {
		billingApi.prices().then((res) => setPlans(res.data.plans)).catch(() => setPlans([]));
	}, []);

	// No prices, no section: a price list with gaps would mislead more than none.
	if (!plans || plans.length === 0) return null;
	const free = plans.find((plan) => plan.plan === 'FREE');

	return (
		<section id="cenik" className="mx-auto w-full max-w-[1600px] px-4 py-14 sm:px-8">
			<div className="flex max-w-3xl flex-col gap-3">
				<span className="text-xs font-bold uppercase tracking-[0.08em] text-primary">{t('public.landing.pricing.kicker')}</span>
				<h2 className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-[34px]">{t('public.landing.pricing.title')}</h2>
				<p className="text-[15px] leading-relaxed text-subtle-foreground">
					{t('public.landing.pricing.text', { teams: free?.limits.teams ?? 6 })}
				</p>
			</div>

			<ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{plans.map((plan) => {
					const highlighted = plan.plan === 'TOURNAMENT_PLUS';
					const vars = {
						teams: plan.limits.teams,
						sponsorLogos: plan.limits.sponsorLogos,
						documents: plan.limits.documents,
					};
					const points = t(`public.landing.pricing.plans.${plan.plan}.points`, { returnObjects: true, ...vars }) as string[];
					return (
						<li
							key={plan.plan}
							className={`flex flex-col gap-4 rounded-2xl border bg-card p-6 ${highlighted ? 'border-primary shadow-lg' : 'border-border'}`}
						>
							<div className="flex flex-col gap-1">
								<h3 className="text-lg font-extrabold">{t(`public.landing.pricing.plans.${plan.plan}.name`)}</h3>
								<p className="text-[13px] text-subtle-foreground">{t(`public.landing.pricing.plans.${plan.plan}.for`)}</p>
							</div>
							<div className="flex flex-col">
								<span className="text-[30px] font-extrabold leading-none tracking-tight tabular-nums">
									{formatMoney(plan.prices.CZK, 'CZK', i18n.language)}
								</span>
								<span className="mt-1.5 text-[12.5px] text-muted-foreground">
									{plan.prices.CZK > 0
										? t(`public.landing.pricing.per.${plan.plan === 'ORGANIZER' ? 'year' : 'tournament'}`, {
											eur: formatMoney(plan.prices.EUR, 'EUR', i18n.language),
										})
										: t('public.landing.pricing.per.free')}
								</span>
							</div>
							<ul className="flex flex-1 flex-col gap-2">
								{points.map((point) => (
									<li key={point} className="flex items-start gap-2 text-sm">
										<Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
										<span>{point}</span>
									</li>
								))}
								{COMING[plan.plan]?.map((key) => (
									<li key={key} className="flex items-start gap-2 text-sm text-subtle-foreground">
										<Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
										<span>
											{t(`public.landing.pricing.coming.${key}`, vars)}{' '}
											<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide">
												{t('public.landing.pricing.soon')}
											</span>
										</span>
									</li>
								))}
							</ul>
						</li>
					);
				})}
			</ul>

			<div className="mt-6 flex flex-wrap items-center justify-between gap-4">
				<p className="text-[13px] text-muted-foreground">{t('public.landing.pricing.note')}</p>
				<Link
					to={signedIn ? '/dashboard' : '/register?role=TOURNAMENT_MANAGER'}
					className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
				>
					{t('public.landing.pricing.cta')}
					<ArrowRight className="size-4" />
				</Link>
			</div>
		</section>
	);
}
