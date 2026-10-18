import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ClipboardSignature } from 'lucide-react';
import { Panel } from '@/components/public';
import { LIFECYCLE_TONE } from '@/components/registrations/RegistrationsPanel';
import type { ManagedCompetition } from '@types';

/**
 * Team applications across every competition the account runs: what waits for
 * a decision, and the forms never published, which is where a manager first
 * hears that teams can apply on their own.
 */
export default function ManagedRegistrationsSection({ rows }: { rows: ManagedCompetition[] }) {
	const { t } = useTranslation();
	if (rows.length === 0) return null;

	return (
		<Panel
			title={t('dashboard.managed.title')}
			description={t('dashboard.managed.text')}
			action={
				<Link to="/docs/prihlasky-tymu" className="text-[13px] font-semibold text-primary hover:underline">
					{t('dashboard.managed.guide')}
				</Link>
			}
			flush
		>
			<ul className="divide-y divide-border">
				{rows.map((row) => {
					const tone = LIFECYCLE_TONE[row.lifecycle];
					const draft = row.lifecycle === 'DRAFT';
					return (
						<li key={`${row.kind}-${row.id}`}>
							<Link to={row.inboxPath} className="flex min-h-[64px] flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 hover:bg-muted/60">
								<span className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
									<span className="truncate text-[15px] font-semibold">{row.name}</span>
									<span className="truncate text-[12.5px] text-muted-foreground">
										{t(`dashboard.managed.kind.${row.kind}`)} · {row.parentName}
									</span>
								</span>
								<span
									className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
									style={{ backgroundColor: tone.bg, color: tone.fg }}
								>
									{t(`registrations.lifecycle.${row.lifecycle}`)}
								</span>
								{row.pending > 0 && (
									<span className="rounded-full bg-warning-soft px-2 py-0.5 text-[12px] font-semibold text-warning-strong">
										{t('dashboard.managed.pending', { count: row.pending })}
									</span>
								)}
								{row.waitlisted > 0 && (
									<span className="text-[12px] text-muted-foreground">{t('dashboard.managed.waitlisted', { count: row.waitlisted })}</span>
								)}
								{draft ? (
									<span className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
										<ClipboardSignature className="size-4" aria-hidden />
										{t('dashboard.managed.publish')}
									</span>
								) : (
									<ChevronRight className="ml-auto size-4 text-muted-foreground" aria-label={t('dashboard.managed.open')} />
								)}
							</Link>
						</li>
					);
				})}
			</ul>
		</Panel>
	);
}
