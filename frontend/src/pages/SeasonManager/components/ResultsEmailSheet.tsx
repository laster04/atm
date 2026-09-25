import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Download, FlaskConical, Mail, Send, Share2, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { seasonApi } from '@/services/api';
import type { RoundSummary, Season, SeasonDigest, UnsentGame } from '@types';
import { SEASON_ACCENT } from './util';
import { formatDateShort, formatGameDateTime } from '@/utils/date';

interface ResultsEmailSheetProps {
	season: Season;
	onClose: () => void;
}

const PREVIEW_DELAY_MS = 300;

/**
 * Whether this browser can hand an image file to the system share sheet
 * (phones, mostly). Elsewhere the card is downloaded instead.
 */
const CAN_SHARE_FILES =
	typeof navigator !== 'undefined' &&
	typeof navigator.canShare === 'function' &&
	navigator.canShare({ files: [new File([], 'probe.png', { type: 'image/png' })] });

interface ShareImage {
	file: File;
	url: string;
}

/**
 * Emails the results of finished games to everyone involved in the season.
 *
 * The manager picks from the finished games no email has mentioned yet, sees
 * what the mail will say, can send a copy to themselves first, and then sends
 * it. Sent games drop off the list, so the next email starts where this one
 * ended.
 */
export default function ResultsEmailSheet({ season, onClose }: ResultsEmailSheetProps) {
	const { t, i18n } = useTranslation();

	const [games, setGames] = useState<UnsentGame[]>([]);
	const [recipientCount, setRecipientCount] = useState(0);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [sent, setSent] = useState<SeasonDigest[]>([]);
	const [preview, setPreview] = useState<RoundSummary | null>(null);
	const [shareImage, setShareImage] = useState<ShareImage | null>(null);
	const [imageLoading, setImageLoading] = useState(false);
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [testing, setTesting] = useState(false);
	const [result, setResult] = useState('');
	const [error, setError] = useState('');

	const reload = useCallback(async () => {
		const [candidates, digests] = await Promise.all([
			seasonApi.getUnsentGames(season.id),
			seasonApi.getSentDigests(season.id),
		]);
		setGames(candidates.data.games);
		setRecipientCount(candidates.data.recipientCount);
		// Everything not sent yet is what a manager usually wants to send.
		setSelected(new Set(candidates.data.games.map((game) => game.id)));
		setSent(digests.data);
	}, [season.id]);

	useEffect(() => {
		setLoading(true);
		reload()
			.catch(() => setError(t('seasonManagement.resultsEmail.loadError')))
			.finally(() => setLoading(false));
	}, [reload, t]);

	const selectedIds = useMemo(
		() => games.filter((game) => selected.has(game.id)).map((game) => game.id),
		[games, selected]
	);

	// The table and scorers come from the server, so the preview follows the
	// selection with a short delay rather than on every tick of a checkbox.
	//
	// The share image is fetched here too, ahead of the tap: iOS only opens the
	// share sheet straight from a tap, and waiting for the image first would
	// lose it.
	useEffect(() => {
		if (selectedIds.length === 0) {
			setPreview(null);
			setShareImage(null);
			return;
		}
		let stale = false;
		const timer = setTimeout(() => {
			seasonApi
				.previewResultsEmail(season.id, selectedIds)
				.then((res) => !stale && setPreview(res.data.summary))
				.catch(() => !stale && setPreview(null));

			setImageLoading(true);
			seasonApi
				.getResultsImage(season.id, selectedIds, i18n.language)
				.then((res) => {
					if (stale) return;
					const file = new File([res.data], `${t('seasonManagement.resultsEmail.imageFile')}.png`, {
						type: 'image/png',
					});
					setShareImage({ file, url: URL.createObjectURL(file) });
				})
				.catch(() => !stale && setShareImage(null))
				.finally(() => !stale && setImageLoading(false));
		}, PREVIEW_DELAY_MS);
		return () => {
			stale = true;
			clearTimeout(timer);
		};
	}, [season.id, selectedIds, i18n.language, t]);

	// Each card is held as an object URL for the thumbnail; let the old one go.
	useEffect(() => {
		return () => {
			if (shareImage) URL.revokeObjectURL(shareImage.url);
		};
	}, [shareImage]);

	const shareCard = async () => {
		if (!shareImage) return;
		setError('');
		if (CAN_SHARE_FILES) {
			try {
				await navigator.share({ files: [shareImage.file] });
			} catch (err) {
				// Closing the share sheet is not an error.
				if ((err as DOMException).name !== 'AbortError') {
					setError(t('seasonManagement.resultsEmail.shareError'));
				}
			}
			return;
		}
		const link = document.createElement('a');
		link.href = shareImage.url;
		link.download = shareImage.file.name;
		link.click();
	};

	const toggle = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const allSelected = games.length > 0 && selectedIds.length === games.length;
	const toggleAll = () => {
		setSelected(allSelected ? new Set() : new Set(games.map((game) => game.id)));
	};

	const errorOf = (err: unknown, fallback: string) =>
		(err as AxiosError<{ error: string }>).response?.data?.error || fallback;

	const sendTest = async () => {
		setTesting(true);
		setError('');
		setResult('');
		try {
			const res = await seasonApi.sendTestResultsEmail(season.id, selectedIds, i18n.language);
			setResult(t('seasonManagement.resultsEmail.testSent', { email: res.data.to }));
		} catch (err) {
			setError(errorOf(err, t('seasonManagement.resultsEmail.testError')));
		} finally {
			setTesting(false);
		}
	};

	const send = async () => {
		setSending(true);
		setError('');
		setResult('');
		try {
			const res = await seasonApi.sendResultsEmail(season.id, selectedIds, i18n.language);
			setResult(
				t('seasonManagement.resultsEmail.sentResult', {
					games: res.data.games,
					delivered: res.data.delivered,
					attempted: res.data.attempted,
				})
			);
			await reload();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			if (axiosError.response?.status === 409) {
				// Someone else sent some of these meanwhile; show what is left.
				setError(t('seasonManagement.resultsEmail.alreadySent'));
				await reload().catch(() => undefined);
			} else {
				setError(errorOf(err, t('seasonManagement.resultsEmail.sendError')));
			}
		} finally {
			setSending(false);
		}
	};

	const lastSent = sent[0];
	const busy = sending || testing;

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
						<h1 className="truncate text-lg font-bold">{t('seasonManagement.resultsEmail.title')}</h1>
						<p className="truncate text-xs text-white/85">{season.name}</p>
					</div>
				</div>
			</div>

			<div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3.5 overflow-y-auto p-4">
				<p className="text-[12.5px] leading-snug text-muted-foreground">
					{t('seasonManagement.resultsEmail.intro')}
				</p>

				<div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5">
					<Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
					<span className="text-[12.5px] text-muted-foreground">
						{t('seasonManagement.resultsEmail.recipients', { count: recipientCount })}
						{lastSent
							? ` · ${t('seasonManagement.resultsEmail.lastSent', {
									when: formatGameDateTime(lastSent.sentAt, i18n.language),
								})}`
							: ''}
					</span>
				</div>

				{loading ? (
					<p className="text-sm text-muted-foreground">{t('common.loading')}</p>
				) : games.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border p-6 text-center">
						<p className="text-sm text-muted-foreground">{t('seasonManagement.resultsEmail.nothingToSend')}</p>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-3">
							<span className="tm-section-label">
								{t('seasonManagement.resultsEmail.unsentGames', {
									selected: selectedIds.length,
									total: games.length,
								})}
							</span>
							<button
								onClick={toggleAll}
								className="text-[12.5px] font-semibold"
								style={{ color: SEASON_ACCENT }}
							>
								{allSelected
									? t('seasonManagement.resultsEmail.selectNone')
									: t('seasonManagement.resultsEmail.selectAll')}
							</button>
						</div>
						<div className="tm-rows-card">
							{games.map((game) => {
								const checked = selected.has(game.id);
								return (
									<label
										key={game.id}
										className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5"
									>
										<input
											type="checkbox"
											checked={checked}
											onChange={() => toggle(game.id)}
											className="size-4 shrink-0"
											style={{ accentColor: SEASON_ACCENT }}
										/>
										<span className="flex min-w-0 flex-1 flex-col gap-0.5">
											<span className="flex items-center gap-2 text-[14px]">
												<span className="min-w-0 flex-1 truncate text-right">{game.homeTeam.name}</span>
												<span className="shrink-0 font-bold tabular-nums">
													{game.homeScore ?? '–'} : {game.awayScore ?? '–'}
												</span>
												<span className="min-w-0 flex-1 truncate">{game.awayTeam.name}</span>
											</span>
											<span className="text-center text-[11.5px] text-muted-foreground">
												{[
													game.round !== null
														? t('seasonManagement.resultsEmail.round', { round: game.round })
														: null,
													formatDateShort(game.date, i18n.language),
													game.confirmedAt ? null : t('seasonManagement.resultsEmail.unconfirmed'),
												]
													.filter(Boolean)
													.join(' · ')}
											</span>
										</span>
									</label>
								);
							})}
						</div>
					</div>
				)}

				{selectedIds.length > 0 && (
					<div className="flex flex-col gap-2">
						<span className="tm-section-label mt-1">{t('seasonManagement.resultsEmail.shareTitle')}</span>
						<p className="text-[12.5px] leading-snug text-muted-foreground">
							{t('seasonManagement.resultsEmail.shareHint')}
						</p>
						{shareImage && (
							<img
								src={shareImage.url}
								alt={t('seasonManagement.resultsEmail.shareTitle')}
								className="mx-auto w-full max-w-[280px] rounded-xl border border-border shadow-sm"
								style={{ opacity: imageLoading ? 0.5 : 1 }}
							/>
						)}
						<button
							onClick={() => void shareCard()}
							disabled={!shareImage || imageLoading}
							className="flex h-11 items-center justify-center gap-2 rounded-[10px] border text-[14.5px] font-semibold disabled:opacity-60"
							style={{ borderColor: SEASON_ACCENT, color: SEASON_ACCENT }}
						>
							{CAN_SHARE_FILES ? (
								<Share2 className="size-4" aria-hidden />
							) : (
								<Download className="size-4" aria-hidden />
							)}
							{imageLoading && !shareImage
								? t('seasonManagement.resultsEmail.imageLoading')
								: CAN_SHARE_FILES
									? t('seasonManagement.resultsEmail.shareImage')
									: t('seasonManagement.resultsEmail.downloadImage')}
						</button>
					</div>
				)}

				{preview && (
					<>
						<span className="tm-section-label mt-1">{t('seasonManagement.resultsEmail.preview')}</span>

						<div className="flex flex-col gap-2">
							<span className="text-[12.5px] font-semibold">{t('seasonManagement.resultsEmail.table')}</span>
							<div className="tm-rows-card">
								{preview.standings.map((row) => (
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

						{preview.topScorers.length > 0 && (
							<div className="flex flex-col gap-2">
								<span className="text-[12.5px] font-semibold">
									{t('seasonManagement.resultsEmail.topScorers')}
								</span>
								<div className="tm-rows-card">
									{preview.topScorers.map((scorer) => (
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

				{sent.length > 0 && (
					<div className="flex flex-col gap-2">
						<span className="tm-section-label mt-1">{t('seasonManagement.resultsEmail.history')}</span>
						<div className="tm-rows-card">
							{sent.map((digest) => (
								<div key={digest.id} className="flex items-center gap-3 px-3.5 py-2 text-[13px]">
									<Check className="size-3.5 shrink-0 text-green-700" aria-hidden />
									<span className="min-w-0 flex-1 truncate">
										{digest.round !== null
											? t('seasonManagement.resultsEmail.round', { round: digest.round })
											: t('seasonManagement.resultsEmail.gameCount', { count: digest._count?.games ?? 0 })}
									</span>
									<span className="shrink-0 text-muted-foreground">
										{formatGameDateTime(digest.sentAt, i18n.language)}
									</span>
									<span className="shrink-0 text-muted-foreground tabular-nums">
										{t('seasonManagement.resultsEmail.delivered', { count: digest.recipientCount })}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{result && <p className="text-sm font-medium text-green-700">{result}</p>}
				{error && <p className="text-sm text-red-600">{error}</p>}
			</div>

			<div className="tm-save-bar shrink-0">
				<button
					onClick={() => void sendTest()}
					disabled={busy || selectedIds.length === 0}
					className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-border px-4 text-[14.5px] font-semibold disabled:opacity-60"
				>
					<FlaskConical className="size-4" aria-hidden />
					{t('seasonManagement.resultsEmail.sendTest')}
				</button>
				<button
					onClick={() => void send()}
					disabled={busy || selectedIds.length === 0}
					className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
					style={{ backgroundColor: SEASON_ACCENT }}
				>
					<Send className="size-4" aria-hidden />
					{t('seasonManagement.resultsEmail.send', { count: selectedIds.length })}
				</button>
			</div>
		</div>
	);
}
