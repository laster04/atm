import { useTranslation } from 'react-i18next';
import { Globe, Link2, Lock } from 'lucide-react';
import { Visibility } from '@types';

const OPTIONS = [
	{ value: Visibility.PUBLIC, icon: Globe },
	{ value: Visibility.UNLISTED, icon: Link2 },
	{ value: Visibility.PRIVATE, icon: Lock },
];

interface VisibilityPickerProps {
	value: Visibility;
	onChange: (value: Visibility) => void;
	disabled?: boolean;
}

/**
 * The three levels in plain words, each with what it means for a visitor. Used
 * wherever a league, a season or a tournament series is edited, so the choice
 * reads the same in every form.
 */
export default function VisibilityPicker({ value, onChange, disabled }: VisibilityPickerProps) {
	const { t } = useTranslation();

	return (
		<div role="radiogroup" aria-label={t('visibility.label')} className="flex flex-col gap-2">
			{OPTIONS.map(({ value: option, icon: Icon }) => {
				const selected = option === value;
				return (
					<button
						key={option}
						type="button"
						role="radio"
						aria-checked={selected}
						disabled={disabled}
						onClick={() => onChange(option)}
						className={`flex items-start gap-3 rounded-[10px] border p-3 text-left transition-colors disabled:opacity-60 ${
							selected ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-muted/50'
						}`}
					>
						<Icon className={`mt-0.5 size-4 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden />
						<span className="flex min-w-0 flex-col gap-0.5">
							<span className="text-sm font-semibold leading-snug">{t(`visibility.options.${option}`)}</span>
							<span className="text-xs leading-snug text-muted-foreground">{t(`visibility.hints.${option}`)}</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}
