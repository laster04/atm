import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Lock, Minus, Plus, Save, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { gameApi } from '@/services/api';
import { GameStatus, type Game } from '@types';
import { SEASON_ACCENT } from './util';

interface ResultSheetProps {
	game: Game;
	onClose: () => void;
	onSaved: (game: Game) => void;
	onOpenReport: () => void;
}

const STATUSES = [
	GameStatus.COMPLETED,
	GameStatus.IN_PROGRESS,
	GameStatus.POSTPONED,
	GameStatus.CANCELLED,
];

export default function ResultSheet({ game, onClose, onSaved, onOpenReport }: ResultSheetProps) {
	const { t, i18n } = useTranslation();

	// A game with a match report has its score computed from that report. Editing
	// the figures here would be overwritten by the next event, so they are shown
	// but not offered for editing, and the save omits them.
	const derived = game.eventsAuthoritative === true;

	const [homeScore, setHomeScore] = useState(game.homeScore ?? 0);
	const [awayScore, setAwayScore] = useState(game.awayScore ?? 0);
	const [periods, setPeriods] = useState<[number | null, number | null][]>([
		[game.period1HomeScore ?? null, game.period1AwayScore ?? null],
		[game.period2HomeScore ?? null, game.period2AwayScore ?? null],
		[game.period3HomeScore ?? null, game.period3AwayScore ?? null],
	]);
	const [status, setStatus] = useState<GameStatus>(
		game.status === GameStatus.SCHEDULED ? GameStatus.COMPLETED : game.status
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const subtitle = [
		typeof game.round === 'number' ? t('seasonManagement.games.round', { n: game.round }) : null,
		game.date
			? new Date(game.date).toLocaleDateString(i18n.language, {
					weekday: 'short',
					day: 'numeric',
					month: 'short',
				})
			: null,
		game.date
			? new Date(game.date).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
			: null,
	]
		.filter(Boolean)
		.join(' · ');

	const setPeriod = (index: number, side: 0 | 1, raw: string) => {
		const value = raw === '' ? null : Math.max(0, Number(raw));
		setPeriods((prev) => {
			const next = [...prev] as [number | null, number | null][];
			const pair = [...next[index]] as [number | null, number | null];
			pair[side] = Number.isNaN(value) ? null : value;
			next[index] = pair;
			return next;
		});
	};

	const handleSave = async () => {
		setError('');
		setSaving(true);
		try {
			const res = await gameApi.update(
				game.id,
				derived
					? { status }
					: {
							homeScore,
							awayScore,
							period1HomeScore: periods[0][0],
							period1AwayScore: periods[0][1],
							period2HomeScore: periods[1][0],
							period2AwayScore: periods[1][1],
							period3HomeScore: periods[2][0],
							period3AwayScore: periods[2][1],
							status,
						}
			);
			onSaved(res.data);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('seasonManagement.result.saveError'));
		} finally {
			setSaving(false);
		}
	};

	const ScoreRow = ({
		name,
		color,
		side,
		value,
		onChange,
	}: {
		name?: string;
		color?: string | null;
		side: string;
		value: number;
		onChange: (next: number) => void;
	}) => (
		<div className="flex items-center gap-2.5">
			<span
				className="size-2.5 shrink-0 rounded-full"
				style={{ backgroundColor: color || '#cbd5e1' }}
			/>
			<span className="flex min-w-0 flex-1 flex-col gap-px">
				<span className="truncate text-[15px] font-semibold">{name}</span>
				<span className="text-[11px] uppercase tracking-wide text-muted-foreground">{side}</span>
			</span>
			<span className="flex shrink-0 items-center gap-1.5">
				{!derived && (
					<button
						onClick={() => onChange(Math.max(0, value - 1))}
						className="flex size-11 items-center justify-center rounded-[11px] border border-border"
						aria-label="-"
					>
						<Minus className="size-4" aria-hidden />
					</button>
				)}
				<span className="w-9 text-center text-2xl font-bold tabular-nums">{value}</span>
				{!derived && (
					<button
						onClick={() => onChange(value + 1)}
						className="flex size-11 items-center justify-center rounded-[11px] border border-border"
						aria-label="+"
					>
						<Plus className="size-4" aria-hidden />
					</button>
				)}
			</span>
		</div>
	);

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-background">
			<div
				className="tm-team-header shrink-0 text-white shadow-md"
				style={{ backgroundColor: SEASON_ACCENT }}
			>
				<div className="flex items-center gap-3 px-4 py-3">
					<button onClick={onClose} className="-ml-2 flex size-10 items-center justify-center rounded-lg">
						<X className="size-5" aria-hidden />
					</button>
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-lg font-bold">{t('seasonManagement.result.title')}</h1>
						{subtitle && <p className="truncate text-xs text-white/85">{subtitle}</p>}
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
				{/* Where the figures below come from, and how to change them */}
				{derived && (
					<div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5">
						<Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
						<p className="text-[12.5px] leading-snug text-muted-foreground">
							{t('seasonManagement.result.derivedNote')}
						</p>
					</div>
				)}
				<button
					onClick={onOpenReport}
					className="flex h-11 items-center justify-center gap-2 rounded-[10px] border text-[14.5px] font-semibold"
					style={{ borderColor: SEASON_ACCENT, color: SEASON_ACCENT }}
				>
					<ClipboardList className="size-4" aria-hidden />
					{t('seasonManagement.result.openReport')}
				</button>

				{/* Final score */}
				<div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
					<span className="tm-section-label">{t('seasonManagement.result.finalScore')}</span>
					<ScoreRow
						name={game.homeTeam?.name}
						color={game.homeTeam?.primaryColor}
						side={t('seasonManagement.result.home')}
						value={homeScore}
						onChange={setHomeScore}
					/>
					<ScoreRow
						name={game.awayTeam?.name}
						color={game.awayTeam?.primaryColor}
						side={t('seasonManagement.result.away')}
						value={awayScore}
						onChange={setAwayScore}
					/>
				</div>

				{/* Periods */}
				<div className="flex flex-col gap-2">
					<div className="flex items-baseline justify-between">
						<span className="tm-section-label">{t('seasonManagement.result.periods')}</span>
						<span className="text-[12.5px] text-muted-foreground">
							{derived
								? t('seasonManagement.result.fromReport')
								: t('seasonManagement.result.optional')}
						</span>
					</div>
					<div className="tm-rows-card">
						{periods.map((pair, index) => (
							<div key={index} className="flex h-[60px] items-center gap-3 px-3.5">
								<span className="w-7 shrink-0 text-[13px] font-semibold text-muted-foreground">
									{t('seasonManagement.result.period', { n: index + 1 })}
								</span>
								<span className="flex-1" />
								<span className="flex items-center gap-2">
									<input
										type="number"
										min={0}
										inputMode="numeric"
										value={pair[0] ?? ''}
										readOnly={derived}
										onChange={(e) => setPeriod(index, 0, e.target.value)}
										className="sm-score-input h-11 w-14 rounded-[10px] bg-input-background text-center text-base font-semibold tabular-nums"
									/>
									<span className="text-sm text-muted-foreground">:</span>
									<input
										type="number"
										min={0}
										inputMode="numeric"
										value={pair[1] ?? ''}
										readOnly={derived}
										onChange={(e) => setPeriod(index, 1, e.target.value)}
										className="sm-score-input h-11 w-14 rounded-[10px] bg-input-background text-center text-base font-semibold tabular-nums"
									/>
								</span>
							</div>
						))}
					</div>
				</div>

				{/* Status */}
				<div className="flex flex-col gap-2">
					<span className="tm-section-label">{t('seasonManagement.result.status')}</span>
					<div className="grid grid-cols-2 gap-2">
						{STATUSES.map((option) => {
							const selected = status === option;
							return (
								<button
									key={option}
									onClick={() => setStatus(option)}
									className="h-11 rounded-[10px] border text-[13.5px] font-semibold"
									style={
										selected
											? { backgroundColor: SEASON_ACCENT, borderColor: SEASON_ACCENT, color: '#ffffff' }
											: undefined
									}
								>
									{t(`tm.status.${option}`)}
								</button>
							);
						})}
					</div>
				</div>

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
					onClick={handleSave}
					disabled={saving}
					className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
					style={{ backgroundColor: SEASON_ACCENT }}
				>
					<Save className="size-4" aria-hidden />
					{derived ? t('seasonManagement.result.saveStatus') : t('seasonManagement.result.save')}
				</button>
			</div>
		</div>
	);
}
