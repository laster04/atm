import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, ClipboardList, Lock, Minus, Plus, Save, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { gameApi } from '@/services/api';
import { GameStatus, type Game, type SeasonResultClaims, type SetFormat, type SportType } from '@types';
import { SEASON_ACCENT } from './util';
import ScorerLinkCard from './ScorerLinkCard';
import PartScoresEditor, { initialParts, toPartScores } from '@/components/PartScoresEditor';
import { partsWon, profileFor } from '@/utils/sportProfiles';
import { APP_TIME_ZONE } from '@/utils/date';

interface ResultSheetProps {
	game: Game;
	/** The scores the two teams reported, if any. */
	claims?: SeasonResultClaims;
	/** Decides the parts (halves, quarters, sets) and whether the score follows from them. */
	sport?: SportType;
	/** Volleyball: the season's set format; to three won sets when it has none. */
	setFormat?: SetFormat;
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

export default function ResultSheet({ game, claims, sport, setFormat, onClose, onSaved, onOpenReport }: ResultSheetProps) {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();

	// A game with a match report has its score computed from that report. Editing
	// the figures here would be overwritten by the next event, so they are shown
	// but not offered for editing, and the save omits them.
	const derived = game.eventsAuthoritative === true;
	// A confirmed game refuses every edit, including the status, until it is
	// reopened from the match report.
	const confirmed = game.confirmedAt != null;

	const profile = profileFor(sport);
	// A game nobody has scored yet starts from what the home team reported, else the away team.
	const reported = claims?.claims.find((c) => c.teamId === game.homeTeamId) ?? claims?.claims[0];
	const [homeScore, setHomeScore] = useState(game.homeScore ?? reported?.homeScore ?? 0);
	const [awayScore, setAwayScore] = useState(game.awayScore ?? reported?.awayScore ?? 0);
	const [parts, setParts] = useState(() => initialParts(game.periodScores, profile, setFormat, game.playoffSeriesId != null));
	// Volleyball: the result is the sets won, so it is shown, not typed.
	const setsWon = profile.scoreIsPartsWon ? partsWon(toPartScores(parts) ?? []) : null;
	const [status, setStatus] = useState<GameStatus>(
		game.status === GameStatus.SCHEDULED ? GameStatus.COMPLETED : game.status
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const subtitle = [
		typeof game.round === 'number' ? t('seasonManagement.games.round', { n: game.round }) : null,
		game.date
			? new Date(game.date).toLocaleDateString(i18n.language, { timeZone: APP_TIME_ZONE, 
					weekday: 'short',
					day: 'numeric',
					month: 'short',
				})
			: null,
		game.date
			? new Date(game.date).toLocaleTimeString(i18n.language, { timeZone: APP_TIME_ZONE,  hour: '2-digit', minute: '2-digit' })
			: null,
	]
		.filter(Boolean)
		.join(' · ');

	// A finished game saved from here is the league's final word on it, so it is
	// confirmed in the same save rather than left waiting in the match report.
	const confirmsOnSave = status === GameStatus.COMPLETED;

	const handleSave = async () => {
		setError('');
		setSaving(true);
		try {
			const res = await gameApi.update(
				game.id,
				derived
					? { status, confirm: confirmsOnSave }
					: {
							homeScore: setsWon?.home ?? homeScore,
							awayScore: setsWon?.away ?? awayScore,
							periodScores: toPartScores(parts),
							status,
							confirm: confirmsOnSave,
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
				{!derived && !setsWon && (
					<button
						onClick={() => onChange(Math.max(0, value - 1))}
						className="flex size-11 items-center justify-center rounded-[11px] border border-border"
						aria-label="-"
					>
						<Minus className="size-4" aria-hidden />
					</button>
				)}
				<span className="w-9 text-center text-2xl font-bold tabular-nums">{value}</span>
				{!derived && !setsWon && (
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
				{(derived || confirmed) && (
					<div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5">
						<Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
						<p className="text-[12.5px] leading-snug text-muted-foreground">
							{confirmed
								? t('seasonManagement.result.confirmedNote')
								: t('seasonManagement.result.derivedNote')}
						</p>
					</div>
				)}
				{profile.events.length > 0 && <button
					onClick={onOpenReport}
					className="flex h-11 items-center justify-center gap-2 rounded-[10px] border text-[14.5px] font-semibold"
					style={{ borderColor: SEASON_ACCENT, color: SEASON_ACCENT }}
				>
					<ClipboardList className="size-4" aria-hidden />
					{t('seasonManagement.result.openReport')}
				</button>}
				{/* Someone without an account keeps the report on the spot */}
				{profile.events.length > 0 && <ScorerLinkCard game={game} />}
				{/* Who played and each player's numbers, for both teams at once */}
				<button
					onClick={() => navigate(`/team-management/game-statistic/${game.id}`)}
					className="flex h-11 items-center justify-center gap-2 rounded-[10px] border text-[14.5px] font-semibold"
					style={{ borderColor: SEASON_ACCENT, color: SEASON_ACCENT }}
				>
					<BarChart3 className="size-4" aria-hidden />
					{t('seasonManagement.result.openPlayerStats')}
				</button>

				{/* What each team reported, to compare with and take over */}
				{claims && claims.claims.length > 0 && (
					<div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
						<div className="flex items-baseline justify-between gap-2">
							<span className="tm-section-label">{t('resultClaim.reported')}</span>
							{claims.state && (
								<span className="text-[12.5px] text-muted-foreground">{t(`resultClaim.badge.${claims.state}`)}</span>
							)}
						</div>
						{[game.homeTeam, game.awayTeam].map((team) => {
							const claim = claims.claims.find((c) => c.teamId === team?.id);
							return (
								<div key={team?.id} className="flex items-center gap-2.5">
									<span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{team?.name}</span>
									{claim ? (
										<>
											<span className="shrink-0 text-[17px] font-bold tabular-nums">
												{claim.homeScore}:{claim.awayScore}
											</span>
											{!derived && !setsWon && !confirmed && (
												<button
													onClick={() => {
														setHomeScore(claim.homeScore);
														setAwayScore(claim.awayScore);
													}}
													className="h-9 shrink-0 rounded-[9px] border border-border px-3 text-[13px] font-semibold"
												>
													{t('resultClaim.useScore')}
												</button>
											)}
										</>
									) : (
										<span className="shrink-0 text-[13px] text-muted-foreground">{t('resultClaim.notReported')}</span>
									)}
								</div>
							);
						})}
					</div>
				)}

				{/* Final score */}
				<div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
					<span className="tm-section-label">{t('seasonManagement.result.finalScore')}</span>
					<ScoreRow
						name={game.homeTeam?.name}
						color={game.homeTeam?.primaryColor}
						side={t('seasonManagement.result.home')}
						value={setsWon?.home ?? homeScore}
						onChange={setHomeScore}
					/>
					<ScoreRow
						name={game.awayTeam?.name}
						color={game.awayTeam?.primaryColor}
						side={t('seasonManagement.result.away')}
						value={setsWon?.away ?? awayScore}
						onChange={setAwayScore}
					/>
				</div>

				{/* Periods */}
				<div className="flex flex-col gap-2">
					<div className="flex items-baseline justify-between">
						<span className="tm-section-label">{t(`sports.partsTitle.${profile.parts.kind}`)}</span>
						<span className="text-[12.5px] text-muted-foreground">
							{derived
								? t('seasonManagement.result.fromReport')
								: setsWon
									? t('sports.parts.setsDecide')
									: t('seasonManagement.result.optional')}
						</span>
					</div>
					<PartScoresEditor
						profile={profile}
						rows={parts}
						onChange={setParts}
						readOnly={derived}
						setFormat={setFormat}
						playoff={game.playoffSeriesId != null}
						inputClassName="sm-score-input h-11 w-14 rounded-[10px] bg-input-background text-center text-base font-semibold tabular-nums"
					/>
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
					disabled={saving || confirmed}
					className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
					style={{ backgroundColor: SEASON_ACCENT }}
				>
					<Save className="size-4" aria-hidden />
					{confirmsOnSave
						? t('seasonManagement.result.saveAndConfirm')
						: derived
							? t('seasonManagement.result.saveStatus')
							: t('seasonManagement.result.save')}
				</button>
			</div>
		</div>
	);
}
