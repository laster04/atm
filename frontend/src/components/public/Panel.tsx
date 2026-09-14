interface PanelProps {
	title?: React.ReactNode;
	description?: React.ReactNode;
	action?: React.ReactNode;
	/** Tables sit flush to the panel's edges; everything else gets padding. */
	flush?: boolean;
	className?: string;
	children: React.ReactNode;
}

/** The white card the public pages put their sections in. */
export default function Panel({ title, description, action, flush, className = '', children }: PanelProps) {
	return (
		<section className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${className}`}>
			{(title || action) && (
				<header className="flex items-start gap-3 border-b border-border px-5 py-4">
					<div className="flex min-w-0 flex-col gap-1">
						{title && <h2 className="text-[17px] font-bold leading-tight">{title}</h2>}
						{description && <div className="text-[13px] text-muted-foreground">{description}</div>}
					</div>
					{action && <div className="ml-auto shrink-0">{action}</div>}
				</header>
			)}
			<div className={flush ? '' : 'p-5'}>{children}</div>
		</section>
	);
}
