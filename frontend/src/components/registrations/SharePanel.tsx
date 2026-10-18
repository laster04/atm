import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { Copy, Download, Mail, MessageCircle, Printer, Share2 } from 'lucide-react';
import type { RegistrationKind } from '@types';
import { formatDeadline } from '@/utils/date';

export const REGISTRATION_SLUG: Record<RegistrationKind, string> = { season: 'sezona', tournament: 'turnaj' };

/** The public form's address, as teams open it. */
export const registrationLink = (kind: RegistrationKind, id: string) =>
	`${window.location.origin}/prihlaska/${REGISTRATION_SLUG[kind]}/${id}`;

interface SharePanelProps {
	kind: RegistrationKind;
	id: string;
	name: string;
	deadline: string | null;
	accent: string;
}

/**
 * Everything a manager needs to get the open form in front of teams: the link,
 * the phone's share sheet, a QR code, a printable poster and ready-made
 * messages for chat, email and social posts.
 */
export default function SharePanel({ kind, id, name, deadline, accent }: SharePanelProps) {
	const { t, i18n } = useTranslation();
	const link = registrationLink(kind, id);
	const [qr, setQr] = useState('');
	const [copied, setCopied] = useState<string | null>(null);

	useEffect(() => {
		QRCode.toDataURL(link, { width: 480, margin: 1 }).then(setQr).catch(() => setQr(''));
	}, [link]);

	const until = formatDeadline(deadline, i18n.language);
	const message = until
		? t('registrations.share.message', { name, deadline: until, link })
		: t('registrations.share.messageNoDeadline', { name, link });
	const post = until
		? t('registrations.share.post', { name, deadline: until, link })
		: t('registrations.share.postNoDeadline', { name, link });
	const subject = t('registrations.share.emailSubject', { name });
	const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

	const copy = async (key: string, value: string) => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(key);
			setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
		} catch {
			setCopied(null);
		}
	};

	const share = async () => {
		try {
			await navigator.share({ title: subject, text: message });
		} catch {
			// The person closed the share sheet; nothing to do.
		}
	};

	const field = 'h-11 w-full rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]';
	const ghost = 'flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-border px-3 text-[13.5px] font-semibold';

	const messages = [
		{ key: 'message', label: t('registrations.share.chatLabel'), text: message },
		{ key: 'post', label: t('registrations.share.postLabel'), text: post },
	];

	return (
		<section id="registrations-share" className="flex flex-col gap-3">
			<span className="tm-section-label">{t('registrations.share.title')}</span>

			<div className="flex gap-2">
				<input readOnly value={link} aria-label={t('registrations.link')} className={`${field} min-w-0 flex-1 font-mono text-[12.5px]`} />
				<button type="button" onClick={() => void copy('link', link)} className={`${ghost} h-11 shrink-0`}>
					<Copy className="size-4" aria-hidden />{copied === 'link' ? t('registrations.copied') : t('registrations.copy')}
				</button>
			</div>

			<div className="flex flex-wrap gap-2">
				{canShare && (
					<button type="button" onClick={() => void share()} className={`${ghost} text-white`} style={{ backgroundColor: accent, borderColor: accent }}>
						<Share2 className="size-4" aria-hidden />{t('registrations.share.native')}
					</button>
				)}
				<a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className={ghost}>
					<MessageCircle className="size-4" aria-hidden />{t('registrations.share.whatsapp')}
				</a>
				<a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`} className={ghost}>
					<Mail className="size-4" aria-hidden />{t('registrations.share.email')}
				</a>
				<a href={`/prihlaska/${REGISTRATION_SLUG[kind]}/${id}/plakat`} target="_blank" rel="noreferrer" className={ghost}>
					<Printer className="size-4" aria-hidden />{t('registrations.share.poster')}
				</a>
			</div>

			{qr && (
				<div className="flex items-center gap-4 rounded-xl border border-border bg-card p-3.5">
					<img src={qr} alt={t('registrations.share.qrAlt', { name })} className="size-28 shrink-0 rounded-md bg-white" />
					<div className="flex min-w-0 flex-col gap-2">
						<p className="text-[13px] text-muted-foreground">{t('registrations.share.qrHint')}</p>
						<a href={qr} download={`${t('registrations.share.qrFile')}.png`} className={`${ghost} self-start`}>
							<Download className="size-4" aria-hidden />{t('registrations.share.qrDownload')}
						</a>
					</div>
				</div>
			)}

			{messages.map((entry) => (
				<div key={entry.key} className="flex flex-col gap-1.5">
					<span className="text-[12.5px] font-medium text-muted-foreground">{entry.label}</span>
					<div className="flex items-start gap-2">
						<p className="min-w-0 flex-1 whitespace-pre-wrap rounded-[10px] border border-border bg-input-background px-3 py-2.5 text-[13.5px]">{entry.text}</p>
						<button type="button" onClick={() => void copy(entry.key, entry.text)} className={`${ghost} shrink-0`} aria-label={t('registrations.share.copyMessage', { label: entry.label })}>
							<Copy className="size-4" aria-hidden />{copied === entry.key ? t('registrations.copied') : t('registrations.copy')}
						</button>
					</div>
				</div>
			))}
		</section>
	);
}
