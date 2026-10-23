import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi } from '@/services/api';
import type { EmbedUsage } from '@types';

/** Where the widget is embedded: sites and views in the last 30 days, busiest competitions first. */
export default function EmbedUsageCard() {
	const { t, i18n } = useTranslation();
	const [usage, setUsage] = useState<EmbedUsage | null>(null);

	useEffect(() => {
		adminApi.embeds().then((res) => setUsage(res.data)).catch((error) => console.error(error));
	}, []);

	const number = (value: number) => value.toLocaleString(i18n.language);
	return (
		<section aria-labelledby="embeds-title" className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="embeds-title" className="text-lg font-extrabold">{t('adminShell.overview.embeds')}</h2>
				{usage && (
					<span className="text-sm font-semibold tabular-nums">
						{number(usage.sites)} · {t('adminShell.overview.embedsViews', { count: usage.views })}
					</span>
				)}
			</div>
			<p className="text-xs text-muted-foreground">{t('adminShell.overview.embedsHint')}</p>
			{usage && usage.competitions.length === 0 && <p className="text-sm text-muted-foreground">{t('adminShell.overview.embedsNone')}</p>}
			{usage && usage.competitions.length > 0 && (
				<ul className="flex flex-col divide-y divide-border">
					{usage.competitions.map((row) => (
						<li key={`${row.kind}:${row.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
							<span className="flex min-w-0 flex-col">
								<Link to={row.kind === 'season' ? `/season-detail/${row.id}` : `/tournament/${row.id}`} className="truncate font-semibold hover:underline">
									{row.name}
								</Link>
								<span className="truncate text-xs text-muted-foreground">{row.sites.join(', ')}</span>
							</span>
							<span className="shrink-0 tabular-nums text-muted-foreground">{t('adminShell.overview.embedsViews', { count: row.views })}</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
