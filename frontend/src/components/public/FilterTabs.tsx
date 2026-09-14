export interface FilterTab<T extends string> {
	value: T;
	label: string;
	icon?: React.ReactNode;
	/** A coloured dot before the label, e.g. green for an active season. */
	dot?: string;
}

interface FilterTabsProps<T extends string> {
	tabs: FilterTab<T>[];
	value: T;
	onChange: (value: T) => void;
	className?: string;
}

/**
 * The pill row the public lists filter with. It scrolls sideways rather than
 * wrapping on a phone, so the chosen pill never jumps to a second line.
 */
export default function FilterTabs<T extends string>({ tabs, value, onChange, className = '' }: FilterTabsProps<T>) {
	return (
		<div className={`no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 sm:mx-0 sm:gap-1.5 sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-1.5 sm:shadow-sm ${className}`}>
			{tabs.map((tab) => {
				const active = tab.value === value;
				return (
					<button
						key={tab.value}
						type="button"
						onClick={() => onChange(tab.value)}
						className={[
							'flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm transition-colors',
							active
								? 'bg-primary font-semibold text-primary-foreground'
								: 'bg-card font-medium text-subtle-foreground hover:bg-muted sm:bg-transparent',
							active ? '' : 'border border-border sm:border-0',
						].join(' ')}
					>
						{tab.dot && !active && <span className="size-2 rounded-full" style={{ backgroundColor: tab.dot }} />}
						{tab.icon}
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
