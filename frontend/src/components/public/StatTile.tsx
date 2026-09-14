interface StatTileProps {
	label: string;
	value: React.ReactNode;
	caption?: React.ReactNode;
	icon?: React.ReactNode;
	/** 0–1; draws the thin bar under the value, e.g. games played of total. */
	progress?: number;
	/** Fills the tile with the primary colour — one per row at most. */
	emphasis?: boolean;
}

export default function StatTile({ label, value, caption, icon, progress, emphasis }: StatTileProps) {
	return (
		<div
			className={[
				'flex flex-col gap-2.5 rounded-2xl border p-5 shadow-sm',
				emphasis ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
			].join(' ')}
		>
			<div className="flex items-center justify-between gap-3">
				<span className={`text-[13px] ${emphasis ? 'text-primary-foreground/80' : 'text-subtle-foreground'}`}>
					{label}
				</span>
				{icon && <span className={emphasis ? 'text-primary-foreground/80' : 'text-muted-foreground'}>{icon}</span>}
			</div>
			<div className="truncate text-[28px] font-extrabold leading-tight tracking-tight">{value}</div>
			{caption && (
				<div className={`text-xs ${emphasis ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
					{caption}
				</div>
			)}
			{progress != null && (
				<div className="h-1.5 overflow-hidden rounded-full bg-accent">
					<div
						className="h-full rounded-full bg-primary"
						style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
					/>
				</div>
			)}
		</div>
	);
}
