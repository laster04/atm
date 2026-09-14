interface EmptyStateProps {
	title: string;
	hint?: string;
	icon?: React.ReactNode;
}

/** What a filtered list shows when nothing matches — never a bare blank card. */
export default function EmptyState({ title, hint, icon }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-sm">
			{icon && <div className="mb-1 text-muted-foreground">{icon}</div>}
			<div className="font-semibold">{title}</div>
			{hint && <div className="max-w-sm text-sm text-muted-foreground">{hint}</div>}
		</div>
	);
}
