import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

export interface SetupStep {
	id: string;
	title: string;
	/** Where the step stands, e.g. "6 teams" or "0 of 30 dated". */
	status: string;
	/** Why it matters; shown only while it is the next step. */
	body: string;
	action: string;
	run: () => void;
	done: boolean;
	/** A way past a step that is fine to leave, e.g. running the teams yourself. */
	skip?: { label: string; run: () => void };
	busy?: boolean;
	/** A short tag beside the title, e.g. "New" for a step a feature just added. */
	badge?: string;
}

interface SetupChecklistProps {
	steps: SetupStep[];
	title: string;
	/** The shell's colour: season navy, or the team's own. */
	accent: string;
	guide: { to: string; label: string };
}

function StepBadge({ label, accent }: { label: string; accent: string }) {
	return (
		<span className="ml-2 inline-block rounded-full px-1.5 py-px align-middle text-[10.5px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: accent }}>
			{label}
		</span>
	);
}

/**
 * Setting something up, in the order it is actually built: the first open step
 * is pulled out as the one thing to do next, the rest stay listed beneath it.
 * Shared by the season and team manager screens.
 */
export default function SetupChecklist({ steps, title, accent, guide }: SetupChecklistProps) {
	const { t } = useTranslation();
	const headingId = useId();
	const listId = useId();
	const nextIndex = steps.findIndex((step) => !step.done);
	const next = steps[nextIndex];
	const doneCount = steps.filter((step) => step.done).length;
	if (!next) return null;

	return (
		<div className="flex flex-col gap-3">
			<section
				aria-labelledby={headingId}
				className="flex flex-col gap-2.5 rounded-xl border-2 bg-card p-4 shadow-sm"
				style={{ borderColor: accent }}
			>
				<span className="tm-section-label">
					{t('setupChecklist.nextLabel', { current: nextIndex + 1, total: steps.length })}
				</span>
				<h2 id={headingId} className="text-[17px] font-bold leading-snug">
					{next.title}
					{next.badge && <StepBadge label={next.badge} accent={accent} />}
				</h2>
				<p className="text-[13.5px] leading-snug text-muted-foreground">{next.body}</p>
				<button
					type="button"
					onClick={next.run}
					disabled={next.busy}
					className="flex h-11 items-center justify-center rounded-[10px] text-[14.5px] font-semibold text-white disabled:opacity-60"
					style={{ backgroundColor: accent }}
				>
					{next.action}
				</button>
				{next.skip && (
					<button
						type="button"
						onClick={next.skip.run}
						className="h-10 text-[13px] font-semibold text-muted-foreground"
					>
						{next.skip.label}
					</button>
				)}
			</section>

			<section aria-labelledby={listId} className="flex flex-col rounded-xl border border-border bg-card px-3.5 pt-3 shadow-sm">
				<div className="flex items-baseline justify-between pb-2">
					<h2 id={listId} className="text-[15px] font-bold">
						{title}
					</h2>
					<span className="text-[13px] text-muted-foreground">
						{t('setupChecklist.progress', { done: doneCount, total: steps.length })}
					</span>
				</div>
				<ol className="flex flex-col">
					{steps.map((step, index) => (
						<li key={step.id} className="flex min-h-[52px] items-center gap-3 border-t border-border-subtle py-2">
							{step.done ? (
								<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
									<Check className="size-3.5" aria-hidden />
									<span className="sr-only">{t('setupChecklist.done')}</span>
								</span>
							) : (
								<span
									className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
										index === nextIndex ? 'text-white' : 'border-2 border-border text-muted-foreground'
									}`}
									style={index === nextIndex ? { backgroundColor: accent } : undefined}
								>
									{index + 1}
								</span>
							)}
							<span className="flex min-w-0 flex-1 flex-col gap-px">
								<span className={`text-sm font-semibold ${step.done ? 'text-muted-foreground' : ''}`}>
									{step.title}
									{step.badge && !step.done && <StepBadge label={step.badge} accent={accent} />}
								</span>
								<span className="text-xs text-muted-foreground">{step.status}</span>
							</span>
						</li>
					))}
				</ol>
				<Link
					to={guide.to}
					className="border-t border-border-subtle py-3 text-center text-[13px] font-medium text-primary"
				>
					{guide.label}
				</Link>
			</section>
		</div>
	);
}
