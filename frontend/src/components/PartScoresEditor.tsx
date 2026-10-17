import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import type { PartScore } from '@types';
import { partLabel, type SportProfile } from '@/utils/sportProfiles';

/** One editable part: either side may still be empty while it is typed. */
export type PartDraft = { home: number | null; away: number | null };

/**
 * The rows a game's parts start with: what is stored, padded to regulation.
 * Volleyball starts with three sets; the fourth and fifth are added as needed.
 */
export const initialParts = (stored: PartScore[] | null | undefined, profile: SportProfile): PartDraft[] => {
	const start = profile.scoreIsPartsWon ? 3 : profile.parts.regulation;
	const rows: PartDraft[] = (stored ?? []).map((part) => ({ home: part.home, away: part.away }));
	while (rows.length < start) rows.push({ home: null, away: null });
	return rows;
};

/**
 * What to send: every part up to the last one with a number in it, empty
 * sides counted as 0, or null when nothing was entered at all.
 */
export const toPartScores = (rows: PartDraft[]): PartScore[] | null => {
	let last = -1;
	rows.forEach((row, index) => {
		if (row.home !== null || row.away !== null) last = index;
	});
	if (last === -1) return null;
	return rows.slice(0, last + 1).map((row) => ({ home: row.home ?? 0, away: row.away ?? 0 }));
};

interface PartScoresEditorProps {
	profile: SportProfile;
	rows: PartDraft[];
	onChange: (rows: PartDraft[]) => void;
	readOnly?: boolean;
	inputClassName?: string;
}

/** Score per period, half, quarter or set, as many as the sport plays. */
export default function PartScoresEditor({ profile, rows, onChange, readOnly, inputClassName }: PartScoresEditorProps) {
	const { t } = useTranslation();
	const start = profile.scoreIsPartsWon ? 3 : profile.parts.regulation;

	const set = (index: number, side: 'home' | 'away', raw: string) => {
		const value = raw === '' ? null : Math.max(0, Math.floor(Number(raw)));
		onChange(rows.map((row, i) => (i === index ? { ...row, [side]: Number.isNaN(value) ? null : value } : row)));
	};

	const input = (index: number, side: 'home' | 'away') => (
		<input
			type="number"
			min={0}
			inputMode="numeric"
			aria-label={`${t(partLabel(profile, index).key, { n: partLabel(profile, index).n })} ${t(`sports.side.${side}`)}`}
			value={rows[index][side] ?? ''}
			readOnly={readOnly}
			onChange={(e) => set(index, side, e.target.value)}
			className={inputClassName ?? 'h-11 w-14 rounded-[10px] border border-border bg-input-background text-center text-base font-semibold tabular-nums'}
		/>
	);

	return (
		<div className="flex flex-col gap-2">
			<div className="tm-rows-card">
				{rows.map((_, index) => {
					const label = partLabel(profile, index);
					return (
						<div key={index} className="flex h-[60px] items-center gap-3 px-3.5">
							<span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-muted-foreground">
								{t(label.key, { n: label.n })}
							</span>
							<span className="flex items-center gap-2">
								{input(index, 'home')}
								<span className="text-sm text-muted-foreground">:</span>
								{input(index, 'away')}
							</span>
							{!readOnly && index >= start && (
								<button
									type="button"
									onClick={() => onChange(rows.filter((__, i) => i !== index))}
									className="flex size-9 items-center justify-center rounded-lg text-muted-foreground"
									aria-label={t('sports.parts.remove')}
								>
									<X className="size-4" aria-hidden />
								</button>
							)}
						</div>
					);
				})}
			</div>
			{!readOnly && rows.length < profile.parts.max && (
				<button
					type="button"
					onClick={() => onChange([...rows, { home: null, away: null }])}
					className="flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border text-[13px] font-semibold text-muted-foreground"
				>
					<Plus className="size-4" aria-hidden />
					{profile.scoreIsPartsWon ? t('sports.parts.addSet') : t('sports.parts.addOvertime')}
				</button>
			)}
		</div>
	);
}
