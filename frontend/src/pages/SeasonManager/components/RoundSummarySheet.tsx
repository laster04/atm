import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Mail, Send, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { seasonApi } from '@/services/api';
import type { Game, RoundSummaryPreview, Season, SeasonDigest } from '@types';
import { SEASON_ACCENT, roundsOf } from './util';
import { APP_TIME_ZONE } from '@/utils/date';

interface RoundSummarySheetProps {
	season: Season;
	games: Game[];
	onClose: () => void;
}

/**
 * Sends the round summary to everyone involved in the season.
 *
 * The mail is shown before it goes out: a manager should see what lands in other
 * people's inboxes rather than trust a button. A round that has already gone out
 * says so and needs a second, explicit confirmation to repeat.
 */
export default function RoundSummarySheet({ season, games, onClose }: RoundSummarySheetProps) {
	const { t, i18n } = useTranslation();

	const rounds = roundsOf(games);
	const [round, setRound] = useState<number | null>(rounds[rounds.length - 1] ?? null);
	const [preview, setPreview] = useState<RoundSummaryPreview | null>(null);
	const [sent, setSent] = useState<SeasonDigest[]>([]);
	const [loading, setLoading] = useState(false);
	const [sending, setSending] = useState(false);
	const [confirmResend, setConfirmResend] = useState(false);
	const [result, setResult] = useState<string>('');
	const [error, setError] = useState('');

	useEffect(() => {
		seasonApi
			.getSentDigests(season.id)
			.then((res) => setSent(res.data))
			.catch(() => undefined);
	}, [season.id]);

	const load = useCallback(
		async (target: number) => {
			setLoading(true);
			setError('');
			setResult('');
			setConfirmResend(false);
			try {
				const res = await seasonApi.previewRoundSummary(season.id, target);
				setPreview(res.data);
			} catch (err) {
				const axiosError = err as AxiosError<{ error: string }>;
				setPreview(null);
				setError(axiosError.response?.data?.error || t('seasonManagement.summary.previewError'));
			} finally {
				setLoading(false);
			}
		},
		[season.id, t]
	);

	useEffect(() => {
		if (round !== null) void load(round);
	}, [round, load]);

	const send = async () => {
		if (round === null) return;
		setSending(true);
		setError('');
		try {
			const res = await seasonApi.sendRoundSummary(season.id, round, confirmResend);
			setResult(
				t('seasonManagement.summary.sentResult', {
					delivered: res.data.delivered,
					attempted: res.data.attempted,
				})
			);
			setConfirmResend(false);
			const [refreshed, digests] = await Promise.all([
				seasonApi.previewRoundSummary(season.id, round),
				seasonApi.getSentDigests(season.id),
			]);
			setPreview(refreshed.data);
			setSent(digests.data);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			if (axiosError.response?.status === 409) {
				// Already sent. Asking once more is the whole guard against a
				// double click putting two copies in every inbox.
				setConfirmResend(true);
				setError(t('seasonManagement.summary.alreadySent'));
			} else {
				setError(axiosError.response?.data?.error || t('seasonManagement.summary.sendError'));
			}
		} finally {
			setSending(false);
		}
	};

	const sentRounds = new Set(sent.map((digest) => digest.round));

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
						<h1 className="truncate text-lg font-bold">{t('seasonManagement.summary.title')}</h1>
						<p className="truncate text-xs text-white/85">{season.name}</p>
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
				<p className="text-[12.5px] leading-snug text-muted-foreground">
					{t('seasonManagement.summary.intro')}
				</p>

				{rounds.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border p-6 text-center">
						<p className="text-sm text-muted-foreground">{t('seasonManagement.summary.noRounds')}</p>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						<span className="tm-section-label">{t('seasonManagement.summary.round')}</span>
						<div className="flex flex-wrap gap-2">
							{rounds.map((option) => (
								<button
									key={option}
									onClick={() => setRound(option)}
									className="flex h-10 min-w-10 items-center justify-center gap-1 rounded-[10px] border px-3 text-[13.5px] font-semibold tabular-nums"
									style={
										round === option
											? { backgroundColor: SEASON_ACCENT, borderColor: SEASON_ACCENT, color: '#ffffff' }
											: undefined
									}
								>
									{option}
									{sentRounds.has(option) && <Check className="size-3.5" aria-hidden />}
								</button>
							))}
						</div>
					</div>
				)}

				{loading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

				{preview && !loading && (
					<>
						<div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5">
							<Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
							<span className="text-[12.5px] text-muted-foreground">
								{t('seasonManagement.summary.recipients', { count: preview.recipientCount })}
								{preview.lastSent
									? ` · ${t('seasonManagement.summary.lastSent', {
											when: new Date(preview.lastSent.sentAt).toLocaleString(i18n.language, { timeZone: APP_TIME_ZONE, 
												day: 'numeric',
												month: 'short',
												hour: '2-digit',
												minute: '2-digit',
											}),
										})}`
									: ''}
							</span>
						</div>

						<div className="flex flex-col gap-2">
							<span className="tm-section-label">{t('seasonManagement.summary.results')}</span>
							<div className="tm-rows-card">
								{preview.summary.results.map((game, index) => (
									<div key={index} className="flex items-center gap-2 px-3.5 py-2.5 text-[14px]">
										<span className="min-w-0 flex-1 truncate text-right">{game.homeTeam}</span>
										<span className="shrink-0 font-bold tabular-nums">
											{game.homeScore ?? '–'} : {game.awayScore ?? '–'}
										</span>
										<span className="min-w-0 flex-1 truncate">{game.awayTeam}</span>
									</div>
								))}
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<span className="tm-section-label">{t('seasonManagement.summary.table')}</span>
							<div className="tm-rows-card">
								{preview.summary.standings.map((row) => (
									<div key={row.team} className="flex items-center gap-3 px-3.5 py-2 text-[14px]">
										<span className="w-5 shrink-0 text-right text-muted-foreground tabular-nums">
											{row.rank}
										</span>
										<span className="min-w-0 flex-1 truncate">{row.team}</span>
										<span className="shrink-0 text-muted-foreground tabular-nums">{row.played}</span>
										<span className="w-8 shrink-0 text-right font-bold tabular-nums">{row.points}</span>
									</div>
								))}
							</div>
						</div>

						{preview.summary.topScorers.length > 0 && (
							<div className="flex flex-col gap-2">
								<span className="tm-section-label">{t('seasonManagement.summary.topScorers')}</span>
								<div className="tm-rows-card">
									{preview.summary.topScorers.map((scorer) => (
										<div key={scorer.name} className="flex items-center gap-3 px-3.5 py-2 text-[14px]">
											<span className="min-w-0 flex-1 truncate">{scorer.name}</span>
											<span className="shrink-0 truncate text-[12px] text-muted-foreground">
												{scorer.team}
											</span>
											<span className="w-12 shrink-0 text-right font-bold tabular-nums">
												{scorer.points}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</>
				)}

				{result && <p className="text-sm font-medium text-green-700">{result}</p>}
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
					onClick={() => void send()}
					disabled={sending || !preview}
					className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
					style={{ backgroundColor: confirmResend ? '#7c2d12' : SEASON_ACCENT }}
				>
					<Send className="size-4" aria-hidden />
					{confirmResend
						? t('seasonManagement.summary.sendAgain')
						: t('seasonManagement.summary.send')}
				</button>
			</div>
		</div>
	);
}
