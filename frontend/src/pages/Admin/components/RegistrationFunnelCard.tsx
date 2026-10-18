import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { registrationApi } from '@/services/api';
import type { RegistrationFunnel } from '@types';

/**
 * Whether organisers find the sign-up forms and teams use them. The figure
 * that matters most is the first: published forms that brought at least one
 * application.
 */
export default function RegistrationFunnelCard() {
	const { t } = useTranslation();
	const [funnel, setFunnel] = useState<RegistrationFunnel | null>(null);

	useEffect(() => {
		registrationApi.funnel().then((res) => setFunnel(res.data)).catch(() => setFunnel(null));
	}, []);

	if (!funnel) return null;

	const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : '–');
	const duration = (hours: number | null) => {
		if (hours === null) return '–';
		return hours < 48 ? t('admin.funnel.hours', { count: Math.round(hours) }) : t('admin.funnel.days', { count: Math.round(hours / 24) });
	};
	const rows = [
		{ key: 'conversion', value: share(funnel.publishedWithApplications, funnel.published), hint: t('admin.funnel.conversionHint', { with: funnel.publishedWithApplications, published: funnel.published }) },
		{ key: 'adoption', value: share(funnel.published, funnel.competitions), hint: t('admin.funnel.adoptionHint', { published: funnel.published, total: funnel.competitions }) },
		{ key: 'toPublish', value: duration(funnel.medianHoursToPublish) },
		{ key: 'toFirst', value: duration(funnel.medianHoursToFirstApplication) },
		{ key: 'approval', value: funnel.approvalRate === null ? '–' : `${Math.round(funnel.approvalRate * 100)} %`, hint: t('admin.funnel.applications', { count: funnel.applications }) },
	];

	return (
		<div className="flex flex-col gap-2">
			<span className="tm-section-label">{t('admin.funnel.title')}</span>
			<div className="tm-rows-card">
				{rows.map((row) => (
					<div key={row.key} className="flex items-center gap-3 px-3 py-3">
						<span className="flex min-w-0 flex-1 flex-col gap-0.5">
							<span className="text-[14.5px] font-semibold">{t(`admin.funnel.${row.key}`)}</span>
							{row.hint && <span className="text-xs text-muted-foreground">{row.hint}</span>}
						</span>
						<span className="shrink-0 text-[15px] font-bold tabular-nums">{row.value}</span>
					</div>
				))}
			</div>
		</div>
	);
}
