import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check } from 'lucide-react';
import { AxiosError } from 'axios';
import { gameApi } from '@/services/api';
import type { Game } from '@types';
import { SEASON_ACCENT, fromLocalInput, roundsOf, toLocalInput } from './util';

interface RoundDatesSheetProps {
	round: number;
	games: Game[];
	onClose: () => void;
	onSaved: (updated: Game[]) => void;
}

/**
 * Dating a season one fixture at a time is the slow path — a round is played on
 * the same evening far more often than not. This sets the round's default once
 * and lets the odd fixture differ, then writes the round in one go.
 *
 * Fixtures with no round at all are collected under round 0.
 */
export default function RoundDatesSheet({ round, games, onClose, onSaved }: RoundDatesSheetProps) {
	const { t, i18n } = useTranslation();

	const rows = useMemo(
		() => games.filter((g) => (g.round ?? 0) === round),
		[games, round]
	);

	const [drafts, setDrafts] = useState<Record<string, string>>(() =>
		Object.fromEntries(rows.map((g) => [g.id, toLocalInput(g.date)]))
	);
	const [defaultDate, setDefaultDate] = useState('');
	const [defaultTime, setDefaultTime] = useState('18:00');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const missing = rows.filter((g) => !drafts[g.id]).length;
	const changed = rows.filter((g) => drafts[g.id] !== toLocalInput(g.date));

	const nextRound = useMemo(() => {
		const all = roundsOf(games);
		return all.find((r) => r > round) ?? null;
	}, [games, round]);

	const applyToAll = () => {
		if (!defaultDate) return;
		const value = `${defaultDate}T${defaultTime || '00:00'}`;
		setDrafts(Object.fromEntries(rows.map((g) => [g.id, value])));
	};

	const handleSave = async () => {
		if (changed.length === 0) {
			onClose();
			return;
		}
		setError('');
		setSaving(true);
		try {
			// No bulk endpoint exists; the round is small enough to write in parallel.
			const results = await Promise.all(
				changed.map((g) => gameApi.update(g.id, { date: fromLocalInput(drafts[g.id]) }))
			);
			onSaved(results.map((res) => res.data));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('seasonManagement.dates.saveError'));
		} finally {
			setSaving(false);
		}
	};

	const whenLabel = (game: Game) => {
		const draft = drafts[game.id];
		if (!draft) return t('seasonManagement.dates.notSet');
		const d = new Date(draft);
		return `${d.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}`;
	};

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-background">
			<div
				className="tm-team-header shrink-0 text-white shadow-md"
				style={{ backgroundColor: SEASON_ACCENT }}
			>
				<div className="flex items-center gap-3 px-4 py-3">
					<button onClick={onClose} className="-ml-2 flex size-10 items-center justify-center rounded-lg">
						<ArrowLeft className="size-5" aria-hidden />
					</button>
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-lg font-bold">
							{t('seasonManagement.dates.title', { n: round })}
						</h1>
						<p className="truncate text-xs text-white/85">
							{t('seasonManagement.dates.subtitle', { count: missing, total: rows.length })}
						</p>
					</div>
				</div>
			</div>

			{/* Round default */}
			<div className="flex shrink-0 flex-col gap-2.5 border-b border-border bg-card p-3.5">
				<span className="tm-section-label">{t('seasonManagement.dates.roundDefault')}</span>
				<div className="flex items-center gap-2">
					<input
						type="date"
						value={defaultDate}
						onChange={(e) => setDefaultDate(e.target.value)}
						className="h-11 flex-1 rounded-[10px] bg-input-background px-3 text-[14.5px] font-medium"
					/>
					{/* A 12-hour locale renders "06:00 PM" here, which a fixed 106px
					    control clips mid-meridiem, so the field sizes to its content. */}
					<input
						type="time"
						value={defaultTime}
						onChange={(e) => setDefaultTime(e.target.value)}
						className="h-11 w-auto shrink-0 rounded-[10px] bg-input-background px-3 text-[14.5px] font-medium"
					/>
				</div>
				<button
					onClick={applyToAll}
					disabled={!defaultDate}
					className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dashed border-border text-[13.5px] font-semibold disabled:opacity-50"
					style={{ color: SEASON_ACCENT }}
				>
					<Check className="size-4" aria-hidden />
					{t('seasonManagement.dates.applyToAll', { count: rows.length })}
				</button>
			</div>

			{/* Per fixture */}
			<div className="flex-1 overflow-y-auto p-3.5">
				<span className="tm-section-label">{t('seasonManagement.dates.fixtures')}</span>
				<div className="mt-2.5 flex flex-col gap-2.5">
					{rows.map((game) => (
						<div
							key={game.id}
							className="flex flex-col gap-2 rounded-xl border bg-card p-3"
							style={{ borderColor: drafts[game.id] ? undefined : '#fcd34d' }}
						>
							<div className="flex min-w-0 flex-col gap-0.5">
								<span className="truncate text-[14.5px] font-semibold leading-tight">
									{game.homeTeam?.name} — {game.awayTeam?.name}
								</span>
								<span
									className="text-[12.5px]"
									style={{ color: drafts[game.id] ? undefined : '#92400e' }}
								>
									{whenLabel(game)}
								</span>
							</div>
							<input
								type="datetime-local"
								value={drafts[game.id] || ''}
								onChange={(e) =>
									setDrafts((prev) => ({ ...prev, [game.id]: e.target.value }))
								}
								className="h-10 w-full rounded-[9px] bg-input-background px-3 text-sm"
							/>
						</div>
					))}
				</div>
			</div>

			{error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

			<div className="tm-save-bar shrink-0">
				<div className="flex min-w-0 flex-1 flex-col gap-px">
					<span className="text-[13px] font-semibold">
						{changed.length > 0
							? t('seasonManagement.dates.toSave', { count: changed.length })
							: t('seasonManagement.dates.nothingToSave')}
					</span>
					<span className="text-[11.5px] text-muted-foreground">
						{nextRound !== null
							? t('seasonManagement.dates.nextRound', { n: nextRound })
							: t('seasonManagement.dates.lastRound')}
					</span>
				</div>
				<button
					onClick={handleSave}
					disabled={saving}
					className="h-11 shrink-0 rounded-[10px] px-5 text-[15px] font-semibold text-white disabled:opacity-60"
					style={{ backgroundColor: SEASON_ACCENT }}
				>
					{t('seasonManagement.dates.save')}
				</button>
			</div>
		</div>
	);
}
