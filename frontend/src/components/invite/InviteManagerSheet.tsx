import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Copy, Send, Share2, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { leagueApi, playerApi, teamApi } from '@/services/api';
import type { InviteKind, ManagerInviteSent } from '@types';
import { APP_TIME_ZONE } from '@/utils/date';
import { menuLanguages, serverLocale } from '@/i18n/languages';

export interface InviteTarget {
	kind: InviteKind;
	/** The team, league or player invited to. */
	id: string;
	/** Shown under the title; for a player, their team. */
	name: string;
}

/** The i18n key suffix for each kind, e.g. titleTeam / titlePlayer. */
const KEY_SUFFIX: Record<InviteKind, string> = { TEAM: 'Team', LEAGUE: 'League', PLAYER: 'Player' };

interface InviteManagerSheetProps {
	target: InviteTarget;
	/** The shell colour: navy for a season, gold for the admin. */
	accent: string;
	/** Text on the accent; gold needs dark ink. */
	accentInk?: string;
	/** Who manages it now; inviting someone else hands it over once they accept. */
	currentManagerName?: string | null;
	/** Fills the name field, e.g. with the player's name from the roster. */
	defaultName?: string;
	/** Opens straight on the "sent" step, e.g. right after a resend. */
	sent?: ManagerInviteSent | null;
	/** Offered on the "sent" step so a whole season can be invited in one go. */
	next?: { label: string; onClick: () => void } | null;
	onSent: (result: ManagerInviteSent) => void;
	onClose: () => void;
}

/**
 * Inviting a team or season manager, or a player, as a full-screen sheet in two
 * steps: the form, then what was sent with the link to pass on by hand.
 * Nothing changes hands when it is sent — the invitee has to accept.
 */
export default function InviteManagerSheet({
	target,
	accent,
	accentInk = '#ffffff',
	currentManagerName,
	defaultName = '',
	sent: initialSent = null,
	next = null,
	onSent,
	onClose,
}: InviteManagerSheetProps) {
	const { t, i18n } = useTranslation();
	const isTeam = target.kind === 'TEAM';
	const isPlayer = target.kind === 'PLAYER';
	const suffix = KEY_SUFFIX[target.kind];

	const [name, setName] = useState(defaultName);
	const [email, setEmail] = useState('');
	// The invitee may read another language than the sender; a language still
	// being checked is offered only to someone already using it.
	const languages = menuLanguages(i18n.language);
	const [locale, setLocale] = useState(serverLocale(i18n.language));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [sent, setSent] = useState<ManagerInviteSent | null>(initialSent);
	const [copied, setCopied] = useState(false);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setError('');
		setSaving(true);
		try {
			const body = { name, email, locale };
			const res = isPlayer
				? await playerApi.invite(target.id, body)
				: await (isTeam ? teamApi : leagueApi).inviteManager(target.id, body);
			setSent(res.data);
			onSent(res.data);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('invites.sheet.error'));
		} finally {
			setSaving(false);
		}
	};

	const shareText = sent
		? t(isPlayer ? 'invites.sent.shareTextPlayer' : 'invites.sent.shareText', { name: sent.invite.name, target: target.name, link: sent.link })
		: '';
	const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

	const share = async () => {
		try {
			await navigator.share({ text: shareText });
		} catch {
			// The person closed the share sheet; nothing to do.
		}
	};

	const copy = async () => {
		if (!sent) return;
		try {
			await navigator.clipboard.writeText(sent.link);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setError(t('invites.sent.copyError'));
		}
	};

	const header = (
		<div className="tm-team-header shrink-0 shadow-md" style={{ backgroundColor: accent, color: accentInk }}>
			<div className="flex items-center gap-3 px-4 py-3">
				<button
					type="button"
					onClick={onClose}
					className="-ml-2 flex size-10 items-center justify-center rounded-lg"
					aria-label={t('common.close')}
				>
					<X className="size-5" aria-hidden />
				</button>
				<div className="min-w-0 flex-1">
					<h1 className="truncate text-lg font-bold">
						{sent
							? t('invites.sent.title')
							: currentManagerName
								? t(`invites.sheet.changeTitle${suffix}`)
								: t(`invites.sheet.title${suffix}`)}
					</h1>
					<p className="truncate text-xs opacity-85">{target.name}</p>
				</div>
			</div>
		</div>
	);

	if (sent) {
		const until = new Date(sent.invite.expiresAt).toLocaleDateString(i18n.language, {
			timeZone: APP_TIME_ZONE,
			day: 'numeric',
			month: 'long',
		});
		const steps = [
			t('invites.sent.next1', { name: sent.invite.name }),
			t(`invites.sent.next2${suffix}`),
			t(`invites.sent.next3${suffix}`),
		];
		return (
			<div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true">
				{header}
				<div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
					<div className="flex flex-col items-center gap-2 pt-2 text-center">
						<span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
							<Check className="size-7" aria-hidden />
						</span>
						<p className="text-[14.5px] leading-snug text-muted-foreground">
							{t('invites.sent.body', { name: sent.invite.name, email: sent.invite.email })}
						</p>
					</div>

					<div className="flex flex-col gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5">
						<p className="text-[13px] leading-snug text-amber-900">{t('invites.sent.spamHint')}</p>
						<div className="flex gap-2">
							{canShare && (
								<button
									type="button"
									onClick={() => void share()}
									className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold"
									style={{ backgroundColor: accent, color: accentInk }}
								>
									<Share2 className="size-4" aria-hidden />
									{t('invites.sent.share')}
								</button>
							)}
							<button
								type="button"
								onClick={() => void copy()}
								className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] border border-border bg-card text-[14px] font-semibold"
							>
								{copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
								{copied ? t('invites.sent.copied') : t('invites.sent.copy')}
							</button>
						</div>
					</div>

					<div className="flex flex-col gap-2.5">
						<span className="tm-section-label">{t('invites.sent.nextTitle')}</span>
						<ol className="flex flex-col gap-2.5">
							{steps.map((step, index) => (
								<li key={index} className="flex items-start gap-3">
									<span
										className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
										style={{ backgroundColor: accent, color: accentInk }}
									>
										{index + 1}
									</span>
									<span className="pt-0.5 text-[13.5px] leading-snug">{step}</span>
								</li>
							))}
						</ol>
						<p className="text-xs text-muted-foreground">{t('invites.sent.until', { date: until })}</p>
					</div>

					{error && <p className="text-sm text-red-600">{error}</p>}
				</div>

				<div className="tm-save-bar shrink-0">
					<button
						type="button"
						onClick={onClose}
						className="h-11 shrink-0 rounded-[10px] border border-border px-4 text-[14.5px] font-semibold"
					>
						{t('invites.sent.done')}
					</button>
					{next && (
						<button
							type="button"
							onClick={next.onClick}
							className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 truncate rounded-[10px] px-3 text-[14.5px] font-semibold"
							style={{ backgroundColor: accent, color: accentInk }}
						>
							<span className="truncate">{next.label}</span>
						</button>
					)}
				</div>
			</div>
		);
	}

	const abilities = t(`invites.sheet.can${suffix}`, { returnObjects: true }) as string[];

	return (
		<form
			onSubmit={(event) => void submit(event)}
			className="fixed inset-0 z-50 flex flex-col bg-background"
			role="dialog"
			aria-modal="true"
		>
			{header}
			<div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
				<div className="flex flex-col gap-1.5">
					<label htmlFor="invite-name" className="text-[13px] font-semibold">
						{t('invites.sheet.nameLabel')}
					</label>
					<input
						id="invite-name"
						type="text"
						required
						autoComplete="off"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={t('invites.sheet.namePlaceholder')}
						className="h-11 rounded-[10px] border border-border bg-card px-3 text-[15px]"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label htmlFor="invite-email" className="text-[13px] font-semibold">
						{t('invites.sheet.emailLabel')}
					</label>
					<input
						id="invite-email"
						type="email"
						required
						autoComplete="off"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder={t('invites.sheet.emailPlaceholder')}
						className="h-11 rounded-[10px] border border-border bg-card px-3 text-[15px]"
					/>
					<span className="text-xs leading-snug text-muted-foreground">{t('invites.sheet.emailHint')}</span>
				</div>

				<fieldset className="flex flex-col gap-1.5">
					<legend className="mb-1.5 text-[13px] font-semibold">{t('invites.sheet.languageLabel')}</legend>
					<div
						className="grid gap-1 rounded-[10px] border border-border bg-muted p-1"
						style={{ gridTemplateColumns: `repeat(${languages.length}, minmax(0, 1fr))` }}
					>
						{languages.map(({ code, label }) => (
							<button
								key={code}
								type="button"
								lang={code}
								aria-pressed={locale === code}
								onClick={() => setLocale(code)}
								className={`h-10 rounded-lg text-[14px] ${
									locale === code ? 'bg-card font-semibold shadow-sm' : 'font-medium text-muted-foreground'
								}`}
							>
								{label}
							</button>
						))}
					</div>
				</fieldset>

				<div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5">
					<span className="text-[13px] font-bold">
						{t(isPlayer ? 'invites.sheet.canTitlePlayer' : 'invites.sheet.canTitle')}
					</span>
					<ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-snug">
						{abilities.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
					{isTeam && <p className="text-xs leading-snug text-muted-foreground">{t('invites.sheet.keepNote')}</p>}
				</div>

				{currentManagerName && (
					<div className="flex gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5">
						<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-800" aria-hidden />
						<p className="text-[13px] leading-snug text-amber-900">
							{t(isTeam ? 'invites.sheet.replaceTeam' : 'invites.sheet.replaceLeague', { name: currentManagerName })}
						</p>
					</div>
				)}

				<p className="text-xs text-muted-foreground">{t('invites.sheet.validity')}</p>
				{error && <p className="text-sm text-red-600">{error}</p>}
			</div>

			<div className="tm-save-bar shrink-0">
				<button
					type="button"
					onClick={onClose}
					className="h-11 shrink-0 rounded-[10px] border border-border px-4 text-[14.5px] font-semibold"
				>
					{t('common.cancel')}
				</button>
				<button
					type="submit"
					disabled={saving}
					className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold disabled:opacity-60"
					style={{ backgroundColor: accent, color: accentInk }}
				>
					<Send className="size-4" aria-hidden />
					{saving ? t('invites.sheet.sending') : t('invites.sheet.submit')}
				</button>
			</div>
		</form>
	);
}
