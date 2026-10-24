import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { tournamentApi } from '@/services/api';
import type { Tournament } from '@types';

const sizeOf = (bytes: number): string =>
	bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;

/**
 * Right under the tournament's header: its documents to download on the left,
 * its partners' logos on the right. Nothing when it has neither.
 */
export default function ExtrasBand({ tournament }: { tournament: Tournament }) {
	const { t } = useTranslation();
	const documents = tournament.documents ?? [];
	const sponsors = tournament.sponsors ?? [];
	if (documents.length === 0 && sponsors.length === 0) return null;

	return (
		<section aria-label={t('plus.band.label')} className="border-b border-border bg-card">
			<div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
				{documents.length > 0 && (
					<div className="flex flex-wrap items-center gap-2">
						<span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('plus.band.documents')}</span>
						{documents.map((doc) => (
							<a
								key={doc.id}
								href={tournamentApi.documentUrl(tournament.id, doc.id)}
								target="_blank"
								rel="noopener"
								className="flex min-h-[40px] items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold hover:border-primary hover:text-primary"
							>
								<FileText className="size-4 shrink-0" aria-hidden />
								{doc.title}
								<span className="text-xs font-normal text-muted-foreground">PDF · {sizeOf(doc.size)}</span>
							</a>
						))}
					</div>
				)}
				{sponsors.length > 0 && (
					<div className="flex flex-wrap items-center gap-x-5 gap-y-3 lg:justify-end">
						<span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('plus.band.partners')}</span>
						{sponsors.map((sponsor) => {
							const mark = <img src={sponsor.logo} alt={sponsor.name} title={sponsor.name} className="h-10 w-auto max-w-[140px] object-contain" />;
							return sponsor.url ? (
								<a key={sponsor.id} href={sponsor.url} target="_blank" rel="noopener sponsored" className="opacity-90 transition-opacity hover:opacity-100">
									{mark}
								</a>
							) : (
								<span key={sponsor.id}>{mark}</span>
							);
						})}
					</div>
				)}
			</div>
		</section>
	);
}
