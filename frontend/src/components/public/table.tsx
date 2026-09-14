/**
 * The public tables share one look: a quiet uppercase header, thin separators,
 * and a 4px inset of the team's colour down the left of a row.
 */
export function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
	return (
		<th className={`px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground ${className}`}>
			{children}
		</th>
	);
}

export function Td({ children, className = '', colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
	return <td className={`px-3 py-3 text-[13px] ${className}`} colSpan={colSpan}>{children}</td>;
}

export function TableShell({ minWidth = 720, children }: { minWidth?: number; children: React.ReactNode }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full border-collapse" style={{ minWidth }}>
				{children}
			</table>
		</div>
	);
}

export function HeadRow({ children }: { children: React.ReactNode }) {
	return <tr className="bg-muted/60">{children}</tr>;
}

/** A body row tinted and edged with the team's colour, when it has one. */
export function TeamRow({ color, children }: { color?: string | null; children: React.ReactNode }) {
	return (
		<tr
			className="border-t border-border-subtle transition-colors hover:bg-muted/50"
			style={color ? { boxShadow: `inset 4px 0 0 ${color}`, backgroundColor: `${color}0a` } : undefined}
		>
			{children}
		</tr>
	);
}
