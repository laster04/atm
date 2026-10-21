import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDay } from '../format';
import { ADMIN_GOLD, ADMIN_INK } from '../util';

/** A white card with a title row, as on canvas page 16. */
export function Card({ title, action, children, accent }: { title: string; action?: ReactNode; children: ReactNode; accent?: boolean }) {
	return (
		<section aria-label={title} className="overflow-hidden rounded-xl border border-border bg-card" style={accent ? { borderTop: `4px solid ${ADMIN_GOLD}` } : undefined}>
			<div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-4 py-3.5">
				<h2 className="text-[17px] font-extrabold">{title}</h2>
				{action}
			</div>
			{children}
		</section>
	);
}

export function SmallButton({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
	return (
		<button type="button" onClick={onClick} disabled={disabled} className="h-9 rounded-lg border border-border bg-card px-3 text-[13px] font-bold disabled:opacity-50">
			{children}
		</button>
	);
}

export function PrimaryButton({ children, disabled, type = 'submit', onClick }: { children: ReactNode; disabled?: boolean; type?: 'submit' | 'button'; onClick?: () => void }) {
	return (
		<button type={type} onClick={onClick} disabled={disabled} className="h-11 flex-1 rounded-lg px-4 text-sm font-extrabold disabled:opacity-50" style={{ backgroundColor: ADMIN_GOLD, color: ADMIN_INK }}>
			{children}
		</button>
	);
}

/** "From 1. 1. 2027" for a planned version, or a dash. */
export function useFromDay() {
	const { i18n } = useTranslation();
	return (value: string | null | undefined) => (value ? formatDay(value, i18n.language) : '—');
}

export const inputClass = 'h-10 rounded-lg border border-border bg-card px-2.5 text-[15px] font-semibold text-foreground';
export const labelClass = 'flex flex-col gap-1 text-xs font-bold text-muted-foreground';
