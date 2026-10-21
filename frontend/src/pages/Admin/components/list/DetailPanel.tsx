import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/components/utils';

export interface PanelTab {
	key: string;
	label: string;
	content: ReactNode;
}

interface DetailPanelProps {
	kicker: string;
	title: ReactNode;
	tabs: PanelTab[];
	onClose: () => void;
	/** Buttons under the tabs' content, on every tab. */
	footer?: ReactNode;
}

/**
 * The record a row opens, beside the list rather than instead of it. On a
 * phone it covers the screen; closing it returns to the list as it was.
 */
export default function DetailPanel({ kicker, title, tabs, onClose, footer }: DetailPanelProps) {
	const { t } = useTranslation();
	const [tab, setTab] = useState(tabs[0]?.key);
	const current = tabs.find((item) => item.key === tab) ?? tabs[0];

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [onClose]);

	return (
		<aside
			aria-label={kicker}
			className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-card lg:sticky lg:top-4 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:min-w-0 lg:flex-[1_1_360px] lg:rounded-xl lg:border lg:border-border"
		>
			<div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
				<div className="flex min-w-0 flex-col gap-1">
					<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{kicker}</span>
					<h2 className="break-words text-lg font-extrabold leading-tight">{title}</h2>
				</div>
				<button
					type="button"
					onClick={onClose}
					aria-label={t('adminShell.panel.close')}
					className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border"
				>
					<X className="size-5" aria-hidden />
				</button>
			</div>

			{tabs.length > 1 && (
				<div role="tablist" aria-label={kicker} className="flex flex-wrap gap-x-1 border-b border-border px-3">
					{tabs.map((item) => (
						<button
							key={item.key}
							type="button"
							role="tab"
							aria-selected={item.key === current?.key}
							onClick={() => setTab(item.key)}
							className={cn(
								'h-10 shrink-0 border-b-[3px] px-2.5 text-[13px]',
								item.key === current?.key ? 'border-[#0F172A] font-bold text-foreground' : 'border-transparent font-semibold text-muted-foreground'
							)}
						>
							{item.label}
						</button>
					))}
				</div>
			)}

			<div role="tabpanel" className="flex flex-1 flex-col gap-3 px-4 py-3.5">{current?.content}</div>
			{footer && <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3.5">{footer}</div>}
		</aside>
	);
}

/** Label/value rows for a panel's overview tab. */
export function PanelFacts({ rows }: { rows: { label: string; value: ReactNode }[] }) {
	return (
		<dl className="grid grid-cols-[minmax(0,130px)_1fr] gap-x-3 gap-y-2 text-[13.5px]">
			{rows.map((row) => (
				<div key={row.label} className="contents">
					<dt className="text-muted-foreground">{row.label}</dt>
					<dd className="m-0 min-w-0 break-words font-semibold">{row.value}</dd>
				</div>
			))}
		</dl>
	);
}

/** A tab whose data arrives with a later celek. */
export function PanelPending({ children }: { children: ReactNode }) {
	return <p className="rounded-lg bg-[#FFF8E1] px-3 py-2.5 text-[13px] leading-snug text-[#334155]">{children}</p>;
}
