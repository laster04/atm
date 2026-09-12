import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, RotateCcw, Save, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { seasonApi } from '@/services/api';
import type { ScoringPolicy, Season, Tiebreaker } from '@types';
import { SEASON_ACCENT } from './util';

interface ScoringSheetProps {
	season: Season;
	onClose: () => void;
	onSaved: (season: Season) => void;
}

const ALL_TIEBREAKERS: Tiebreaker[] = ['GOAL_DIFF', 'GOALS_FOR', 'HEAD_TO_HEAD', 'WINS', 'PLAYED'];

/**
 * What a season falls back to when it carries no scoring of its own. It matches
 * the server's league default, so the sheet opens showing what the table is
 * actually being scored on rather than an empty form.
 */
const INHERITED: ScoringPolicy = {
	winPoints: 2,
	drawPoints: 1,
	lossPoints: 0,
	otWinPoints: 2,
	otLossPoints: 1,
	allowDraws: true,
	tiebreakers: ['GOAL_DIFF', 'GOALS_FOR'],
};

export default function ScoringSheet({ season, onClose, onSaved }: ScoringSheetProps) {
	const { t } = useTranslation();

	const [policy, setPolicy] = useState<ScoringPolicy>(season.scoring ?? INHERITED);
	// Null on the season means "inherit". Saving from an inherited state writes an
	// explicit policy; resetting clears it back to inheriting.
	const [custom, setCustom] = useState(season.scoring != null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const patch = (next: Partial<ScoringPolicy>) => {
		setPolicy((prev) => ({ ...prev, ...next }));
		setCustom(true);
	};

	const points: { key: keyof ScoringPolicy; label: string }[] = [
		{ key: 'winPoints', label: t('seasonManagement.scoring.win') },
		{ key: 'drawPoints', label: t('seasonManagement.scoring.draw') },
		{ key: 'lossPoints', label: t('seasonManagement.scoring.loss') },
	];

	const toggleTiebreaker = (tiebreaker: Tiebreaker) => {
		const active = policy.tiebreakers.includes(tiebreaker);
		patch({
			tiebreakers: active
				? policy.tiebreakers.filter((entry) => entry !== tiebreaker)
				: [...policy.tiebreakers, tiebreaker],
		});
	};

	const move = (index: number, direction: -1 | 1) => {
		const next = [...policy.tiebreakers];
		const target = index + direction;
		if (target < 0 || target >= next.length) return;
		[next[index], next[target]] = [next[target], next[index]];
		patch({ tiebreakers: next });
	};

	const save = async (value: ScoringPolicy | null) => {
		setError('');
		setSaving(true);
		try {
			const res = await seasonApi.update(season.id, { scoring: value });
			onSaved(res.data);
			onClose();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('seasonManagement.scoring.saveError'));
		} finally {
			setSaving(false);
		}
	};

	const inactive = ALL_TIEBREAKERS.filter((entry) => !policy.tiebreakers.includes(entry));

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-background">
			<div className="tm-team-header shrink-0 text-white shadow-md" style={{ backgroundColor: SEASON_ACCENT }}>
				<div className="flex items-center gap-3 px-4 py-3">
					<button
						onClick={onClose}
						className="-ml-2 flex size-10 items-center justify-center rounded-lg"
						aria-label={t('common.close')}
					>
						<X className="size-5" aria-hidden />
					</button>
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-lg font-bold">{t('seasonManagement.scoring.title')}</h1>
						<p className="truncate text-xs text-white/85">{season.name}</p>
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
				<p className="text-[12.5px] leading-snug text-muted-foreground">
					{custom
						? t('seasonManagement.scoring.customNote')
						: t('seasonManagement.scoring.inheritedNote')}
				</p>

				<div className="flex flex-col gap-2">
					<span className="tm-section-label">{t('seasonManagement.scoring.points')}</span>
					<div className="tm-rows-card">
						{points.map((row) => (
							<div key={row.key} className="flex h-[60px] items-center gap-3 px-3.5">
								<span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{row.label}</span>
								<input
									type="number"
									min={0}
									inputMode="numeric"
									value={policy[row.key] as number}
									onChange={(e) => patch({ [row.key]: Math.max(0, Number(e.target.value) || 0) })}
									className="sm-score-input h-11 w-16 rounded-[10px] bg-input-background text-center text-base font-semibold tabular-nums"
								/>
							</div>
						))}
						<div className="flex h-[60px] items-center gap-3 px-3.5">
							<span className="flex min-w-0 flex-1 flex-col gap-px">
								<span className="truncate text-[14.5px] font-medium">
									{t('seasonManagement.scoring.allowDraws')}
								</span>
								<span className="truncate text-[11.5px] text-muted-foreground">
									{t('seasonManagement.scoring.allowDrawsHint')}
								</span>
							</span>
							<button
								role="switch"
								aria-checked={policy.allowDraws}
								onClick={() => patch({ allowDraws: !policy.allowDraws })}
								className="h-7 w-12 shrink-0 rounded-full border border-border p-0.5"
								style={policy.allowDraws ? { backgroundColor: SEASON_ACCENT, borderColor: SEASON_ACCENT } : undefined}
							>
								<span
									className="block size-6 rounded-full bg-white shadow-sm transition-transform"
									style={policy.allowDraws ? { transform: 'translateX(20px)' } : undefined}
								/>
							</button>
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<div className="flex items-baseline justify-between">
						<span className="tm-section-label">{t('seasonManagement.scoring.tiebreakers')}</span>
						<span className="text-[12.5px] text-muted-foreground">
							{t('seasonManagement.scoring.inOrder')}
						</span>
					</div>
					<div className="tm-rows-card">
						{policy.tiebreakers.length === 0 && (
							<div className="px-3.5 py-4 text-center text-[13px] text-muted-foreground">
								{t('seasonManagement.scoring.noTiebreakers')}
							</div>
						)}
						{policy.tiebreakers.map((tiebreaker, index) => (
							<div key={tiebreaker} className="flex h-[56px] items-center gap-2 px-3.5">
								<span className="w-5 shrink-0 text-[13px] font-semibold text-muted-foreground tabular-nums">
									{index + 1}
								</span>
								<span className="min-w-0 flex-1 truncate text-[14px] font-medium">
									{t(`seasonManagement.scoring.tb.${tiebreaker}`)}
								</span>
								<button
									onClick={() => move(index, -1)}
									disabled={index === 0}
									className="flex size-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"
									aria-label={t('seasonManagement.scoring.moveUp')}
								>
									<ArrowUp className="size-4" aria-hidden />
								</button>
								<button
									onClick={() => move(index, 1)}
									disabled={index === policy.tiebreakers.length - 1}
									className="flex size-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"
									aria-label={t('seasonManagement.scoring.moveDown')}
								>
									<ArrowDown className="size-4" aria-hidden />
								</button>
								<button
									onClick={() => toggleTiebreaker(tiebreaker)}
									className="flex size-9 items-center justify-center rounded-lg border border-border"
									aria-label={t('common.delete')}
								>
									<X className="size-4" aria-hidden />
								</button>
							</div>
						))}
					</div>

					{inactive.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{inactive.map((tiebreaker) => (
								<button
									key={tiebreaker}
									onClick={() => toggleTiebreaker(tiebreaker)}
									className="h-9 rounded-full border border-border px-3 text-[13px] font-medium"
								>
									+ {t(`seasonManagement.scoring.tb.${tiebreaker}`)}
								</button>
							))}
						</div>
					)}
				</div>

				{custom && (
					<button
						onClick={() => void save(null)}
						disabled={saving}
						className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-border text-[14.5px] font-semibold disabled:opacity-60"
					>
						<RotateCcw className="size-4" aria-hidden />
						{t('seasonManagement.scoring.reset')}
					</button>
				)}

				{error && <p className="text-sm text-red-600">{error}</p>}
			</div>

			<div className="tm-save-bar shrink-0">
				<button
					onClick={onClose}
					className="h-11 shrink-0 rounded-[10px] border border-border px-4 text-[14.5px] font-semibold"
				>
					{t('common.cancel')}
				</button>
				<button
					onClick={() => void save(policy)}
					disabled={saving}
					className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
					style={{ backgroundColor: SEASON_ACCENT }}
				>
					<Save className="size-4" aria-hidden />
					{t('seasonManagement.scoring.save')}
				</button>
			</div>
		</div>
	);
}
