import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { isAxiosError } from 'axios';
import { Copy, Link2, Lock, MapPin, Share2, XCircle } from 'lucide-react';
import { Button } from '@components/base/button';
import { tournamentScorerLinkApi } from '@/services/api';
import type { TournamentScorerCourt, TournamentScorerLinks } from '@types';
import { APP_TIME_ZONE } from '@/utils/date';

const ACCENT = '#7c3aed';

interface ScorerLinksPanelProps {
	tournamentId: string;
	tournamentName: string;
	/** Opens the plan offer: scorer links come with the paid plans. */
	onUpgrade: () => void;
}

/**
 * The organiser hands each court of the tournament to a volunteer without an
 * account: one link per court opens the games played there. The address is
 * shown once, right after it is made, since only its hash is kept.
 */
export default function ScorerLinksPanel({ tournamentId, tournamentName, onUpgrade }: ScorerLinksPanelProps) {
	const { t } = useTranslation();
	const [state, setState] = useState<TournamentScorerLinks | null>(null);
	const [error, setError] = useState('');

	const load = () =>
		tournamentScorerLinkApi
			.list(tournamentId)
			.then((res) => setState(res.data))
			.catch(() => setError(t('courtLinks.errors.load')));
	useEffect(() => {
		void load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tournamentId]);

	if (!state) return <div className="py-8 text-center text-sm text-muted-foreground">{error || t('tm.common.loading')}</div>;

	if (!state.mode) {
		return <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">{t('courtLinks.unsupported')}</div>;
	}

	return (
		<div className="flex max-w-2xl flex-col gap-4">
			<p className="text-sm text-muted-foreground">{t('courtLinks.intro')}</p>

			{!state.allowed && (
				<div className="flex flex-col gap-3 rounded-xl border-2 border-violet-300 bg-violet-50 p-4 sm:flex-row sm:items-center">
					<Lock className="size-5 shrink-0 text-violet-700" aria-hidden />
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<span className="text-[15px] font-semibold">{t('courtLinks.locked.title')}</span>
						<span className="text-[13px] text-muted-foreground">{t('courtLinks.locked.body')}</span>
					</div>
					<Button size="sm" className="shrink-0 bg-violet-700 hover:bg-violet-800" onClick={onUpgrade}>
						{t('courtLinks.locked.action')}
					</Button>
				</div>
			)}

			{error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

			{state.courts.length === 0 ? (
				<div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">{t('courtLinks.noCourts')}</div>
			) : (
				state.courts.map((court) => (
					<CourtCard
						key={court.location}
						tournamentId={tournamentId}
						tournamentName={tournamentName}
						court={court}
						allowed={state.allowed}
						onUpgrade={onUpgrade}
						onChanged={(link) =>
							setState((prev) =>
								prev && {
									...prev,
									courts: prev.courts.map((c) => (c.location === court.location ? { ...c, link } : c)),
								}
							)
						}
					/>
				))
			)}
		</div>
	);
}

function CourtCard({
	tournamentId,
	tournamentName,
	court,
	allowed,
	onUpgrade,
	onChanged,
}: {
	tournamentId: string;
	tournamentName: string;
	court: TournamentScorerCourt;
	allowed: boolean;
	onUpgrade: () => void;
	onChanged: (link: TournamentScorerCourt['link']) => void;
}) {
	const { t, i18n } = useTranslation();
	const [url, setUrl] = useState('');
	const [qr, setQr] = useState('');
	const [label, setLabel] = useState('');
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!url) {
			setQr('');
			return;
		}
		QRCode.toDataURL(url, { width: 480, margin: 1 }).then(setQr).catch(() => setQr(''));
	}, [url]);

	const link = court.link;
	const active = link?.status === 'ACTIVE';
	const when = (value: string) =>
		new Date(value).toLocaleString(i18n.language, {
			timeZone: APP_TIME_ZONE,
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});

	const create = async () => {
		if (!allowed) {
			onUpgrade();
			return;
		}
		setError('');
		setBusy(true);
		try {
			// A replacement goes to the same person unless a new name is typed.
			const res = await tournamentScorerLinkApi.create(tournamentId, court.location, label.trim() || link?.label || '');
			onChanged(res.data.link);
			// The volunteer opens the same site the organiser is on, wherever APP_URL points.
			setUrl(window.location.origin + new URL(res.data.url).pathname);
			setLabel('');
		} catch (err) {
			const code = isAxiosError<{ code?: string }>(err) ? err.response?.data?.code : undefined;
			if (code === 'PLAN_FEATURE') onUpgrade();
			else setError(t('scorerLink.createError'));
		} finally {
			setBusy(false);
		}
	};

	const revoke = async () => {
		if (!link) return;
		setError('');
		setBusy(true);
		try {
			await tournamentScorerLinkApi.revoke(tournamentId, link.id);
			onChanged(null);
			setUrl('');
		} catch {
			setError(t('scorerLink.revokeError'));
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

	const message = t('courtLinks.message', { tournament: tournamentName, court: court.location, link: url });
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
			<div className="flex items-center gap-2">
				<MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
				<span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{court.location}</span>
				<span className="shrink-0 text-[12.5px] text-muted-foreground">{t('courtLinks.games', { count: court.games })}</span>
			</div>

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
							style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
						>
							<Share2 className="size-4" aria-hidden />
							{t('scorerLink.share')}
						</button>
					)}
					{qr && (
						<div className="flex items-center gap-3.5">
							<img src={qr} alt={t('scorerLink.qrAlt')} className="size-28 shrink-0 rounded-md bg-white" />
							<p className="text-[12.5px] leading-snug text-muted-foreground">{t('courtLinks.qrHint')}</p>
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
						{link?.status === 'EXPIRED' ? t('scorerLink.expired') : t('courtLinks.hint')}
					</p>
					{allowed && (
						<input
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							maxLength={80}
							placeholder={t('courtLinks.labelPlaceholder')}
							aria-label={t('courtLinks.labelPlaceholder')}
							className="h-11 rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]"
						/>
					)}
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
					style={{ borderColor: ACCENT, color: ACCENT }}
				>
					{allowed ? <Link2 className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
					{active ? t('scorerLink.replace') : t('scorerLink.create')}
				</button>
			</div>
			{active && !url && <p className="text-[12px] leading-snug text-muted-foreground">{t('scorerLink.replaceHint')}</p>}

			{error && <p className="text-sm text-red-600">{error}</p>}
		</div>
	);
}
