import { useTranslation } from 'react-i18next';
import { cn } from '@components/utils';
import type { PlayerPosition } from '@types';

interface PositionSelectProps {
	id?: string;
	value: PlayerPosition | '' | null | undefined;
	positions: PlayerPosition[];
	onChange: (value: PlayerPosition | '') => void;
	className?: string;
}

/**
 * A player's position, picked from the sport's list. Callers hide the field
 * when the sport has no positions rather than showing an empty choice.
 */
export default function PositionSelect({ id, value, positions, onChange, className }: PositionSelectProps) {
	const { t } = useTranslation();

	return (
		<select
			id={id}
			value={value ?? ''}
			onChange={(e) => onChange(e.target.value as PlayerPosition | '')}
			className={cn(
				'border-input flex h-9 w-full min-w-0 rounded-md border bg-input-background px-3 py-1 text-base outline-none md:text-sm',
				'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
				className,
			)}
		>
			<option value="">{t('playerPositions.none')}</option>
			{positions.map((position) => (
				<option key={position} value={position}>
					{t(`playerPositions.${position}`)}
				</option>
			))}
		</select>
	);
}
