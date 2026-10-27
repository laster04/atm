import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { Copy, Link2, Share2, XCircle } from 'lucide-react';
import { AxiosError } from 'axios';
import { gameApi } from '@/services/api';
import type { Game, ScorerLinkState } from '@types';
import { SEASON_ACCENT } from './util';
import { APP_TIME_ZONE } from '@/utils/date';

interface ScorerLinkCardProps {
	game: Game;
}

/**
 * The season manager hands one game's report to someone without an account:
 * the scorekeeper at the rink, a referee. The address is shown once, right
 * after it is made, since only its hash is kept; a lost one is replaced.
 */
export default function ScorerLinkCard({ game }: ScorerLinkCardProps) {
	const { t, i18n } = useTranslation();
	const [state, setState] = useState<ScorerLinkState | null>(null);
	const [url, setUrl] = useState('');
	const [qr, setQr] = useState('');
	const [label, setLabel] = useState('');
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		gameApi.getScorerLink(game.id).then((res) => setState(res.data)).catch(() => setState(null));
	}, [game.id]);

	useEffect(() => {
		if (!url) {
			setQr('');
			return;
		}
		QRCode.toDataURL(url, { width: 480, margin: 1 }).then(setQr).catch(() => setQr(''));
	}, [url]);

	// Nothing to hand out in a sport without a goal report, or once the game is closed.
	if (!state?.supported || game.confirmedAt) return null;

	const link = state.link;
	const active = link?.status === 'ACTIVE';
	const when = (value: string) =>
		new Date(value).toLocaleString(i18n.language, {
			timeZone: APP_TIME_ZONE,
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});

	const failWith = (err: unknown, fallback: string) => {
		const axiosError = err as AxiosError<{ error: string }>;
		setError(axiosError.response?.data?.error || fallback);
	};

	const create = async () => {
		setError('');
		setBusy(true);
		try {
			// A replacement goes to the same person unless a new name is typed.
			const res = await gameApi.createScorerLink(game.id, label.trim() || link?.label || '');
			setState({ supported: true, link: res.data.link });
			// The scorer opens the same site the manager is on, wherever APP_URL points.
			setUrl(window.location.origin + new URL(res.data.url).pathname);
			setLabel('');
		} catch (err) {
			failWith(err, t('scorerLink.createError'));
		} finally {
			setBusy(false);
		}
	};

	const revoke = async () => {
		setError('');
		setBusy(true);
		try {
			await gameApi.revokeScorerLink(game.id);
			setState({ supported: true, link: null });
			setUrl('');
		} catch (err) {
			failWith(err, t('scorerLink.revokeError'));
		} finally {
			setBusy(false);
		}
	};

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	};

	const message = t('scorerLink.message', {
		home: game.homeTeam?.name ?? '',
		away: game.awayTeam?.name ?? '',
		link: url,
	});
	const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
	const share = async () => {
		try {
			await navigator.share({ title: t('scorerLink.title'), text: message });
		} catch {
			// The share sheet was closed; nothing to do.
		}
	};

	const ghost = 'flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-border px-3 text-[13.5px] font-semibold';

	return (
		<div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
			<span className="tm-section-label">{t('scorerLink.title')}</span>

			{url && active ? (
				<>
					<p className="text-[12.5px] leading-snug text-muted-foreground">
						{t('scorerLink.shownOnce', { until: when(link.expiresAt) })}
					</p>
					<div className="flex gap-2">
						<input
							readOnly
							value={url}
							aria-label={t('scorerLink.title')}
							className="h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-input-background px-3 font-mono text-[12.5px]"
						/>
						<button type="button" onClick={() => void copy()} className={`${ghost} h-11 shrink-0`}>
							<Copy className="size-4" aria-hidden />
							{copied ? t('scorerLink.copied') : t('scorerLink.copy')}
						</button>
					</div>
					{canShare && (
						<button
							type="button"
							onClick={() => void share()}
							className={`${ghost} text-white`}
							style={{ backgroundColor: SEASON_ACCENT, borderColor: SEASON_ACCENT }}
						>
							<Share2 className="size-4" aria-hidden />
							{t('scorerLink.share')}
						</button>
					)}
					{qr && (
						<div className="flex items-center gap-3.5">
							<img src={qr} alt={t('scorerLink.qrAlt')} className="size-28 shrink-0 rounded-md bg-white" />
							<p className="text-[12.5px] leading-snug text-muted-foreground">{t('scorerLink.qrHint')}</p>
						</div>
					)}
				</>
			) : active ? (
				<p className="text-[13px] leading-snug">
					{link.label
						? t('scorerLink.activeFor', { name: link.label, until: when(link.expiresAt) })
						: t('scorerLink.active', { until: when(link.expiresAt) })}
					{link.lastUsedAt && (
						<span className="block text-[12.5px] text-muted-foreground">
							{t('scorerLink.lastUsed', { when: when(link.lastUsedAt) })}
						</span>
					)}
				</p>
			) : (
				<>
					<p className="text-[12.5px] leading-snug text-muted-foreground">
						{link?.status === 'EXPIRED' ? t('scorerLink.expired') : t('scorerLink.hint')}
					</p>
					<input
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						maxLength={80}
						placeholder={t('scorerLink.labelPlaceholder')}
						aria-label={t('scorerLink.labelPlaceholder')}
						className="h-11 rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]"
					/>
				</>
			)}

			<div className="flex gap-2">
				{active && (
					<button type="button" onClick={() => void revoke()} disabled={busy} className={`${ghost} flex-1 disabled:opacity-60`}>
						<XCircle className="size-4" aria-hidden />
						{t('scorerLink.revoke')}
					</button>
				)}
				<button
					type="button"
					onClick={() => void create()}
					disabled={busy}
					className={`${ghost} flex-1 disabled:opacity-60`}
					style={{ borderColor: SEASON_ACCENT, color: SEASON_ACCENT }}
				>
					<Link2 className="size-4" aria-hidden />
					{active ? t('scorerLink.replace') : t('scorerLink.create')}
				</button>
			</div>
			{active && !url && (
				<p className="text-[12px] leading-snug text-muted-foreground">{t('scorerLink.replaceHint')}</p>
			)}

			{error && <p className="text-sm text-red-600">{error}</p>}
		</div>
	);
}
