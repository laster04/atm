export interface SectionTab<T extends string> {
	value: T;
	label: string;
	icon?: React.ReactNode;
}

interface SectionTabsProps<T extends string> {
	tabs: SectionTab<T>[];
	value: T;
	onChange: (value: T) => void;
}

/**
 * The strip of underline tabs a detail page hangs its sections from. It sits
 * directly under the hero, on white, and scrolls sideways on a phone so a
 * season with five sections never wraps into two rows of tabs.
 */
export default function SectionTabs<T extends string>({ tabs, value, onChange }: SectionTabsProps<T>) {
	return (
		<div className="border-b border-border bg-card">
			<div className="no-scrollbar mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 sm:px-8">
				{tabs.map((tab) => {
					const active = tab.value === value;
					return (
						<button
							key={tab.value}
							type="button"
							onClick={() => onChange(tab.value)}
							className={[
								'flex h-14 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 text-sm transition-colors',
								active
									? 'border-primary font-semibold text-primary'
									: 'border-transparent font-medium text-subtle-foreground hover:text-foreground',
							].join(' ')}
						>
							{tab.icon}
							{tab.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
