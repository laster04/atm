import * as React from 'react';
import { cn } from '@components/utils';

/**
 * The admin tables carry five to eight columns. The base `Table` scrolls
 * horizontally rather than breaking the page, but on a phone that puts the
 * actions column off-screen, so editing any row means scrolling right first —
 * every row, every time.
 *
 * These wrappers render the table on `md` and up and a list of cards below it,
 * where each row is a card with its actions inline. Card contents stay
 * per-entity: a game needs both team names on their own line, a user does not.
 */

/** Desktop-only wrapper for the existing `<Table>`. */
export function AdminTableView({ children }: { children: React.ReactNode }) {
	return <div className="hidden md:block">{children}</div>;
}

/** Phone-only card list standing in for the table. */
export function AdminCardView({ children }: { children: React.ReactNode }) {
	return <div className="md:hidden space-y-2">{children}</div>;
}

interface AdminCardProps {
	/** Primary identifier for the row — the name you scan the list for. */
	title: React.ReactNode;
	/** Row actions, rendered inline so they never scroll out of reach. */
	actions?: React.ReactNode;
	children?: React.ReactNode;
	className?: string;
	/** For rows that carry their own identity colour, e.g. a team's. */
	style?: React.CSSProperties;
}

export function AdminCard({ title, actions, children, className, style }: AdminCardProps) {
	return (
		<div className={cn('rounded-lg border bg-card p-3', className)} style={style}>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1 font-medium">{title}</div>
				{actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
			</div>
			{children && <dl className="mt-2 space-y-1">{children}</dl>}
		</div>
	);
}

/** One label/value pair inside a card. Values that are empty are skipped. */
export function AdminCardField({ label, children }: { label: string; children: React.ReactNode }) {
	if (children === null || children === undefined || children === '') return null;
	return (
		<div className="flex justify-between gap-3 text-sm">
			<dt className="shrink-0 text-muted-foreground">{label}</dt>
			<dd className="min-w-0 truncate text-right">{children}</dd>
		</div>
	);
}
