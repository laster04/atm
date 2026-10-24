import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { registrationApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { RegistrationForm, RegistrationKind } from '@types';
import { formatDeadline } from '@/utils/date';
import { PoweredByAtm } from '@/components/public';

const KIND_BY_SLUG: Record<string, RegistrationKind> = { sezona: 'season', turnaj: 'tournament' };

/**
 * A page to print and pin up at the club: the competition, its terms and a
 * QR code that opens the application form. No site header, so it prints on
 * one sheet.
 */
export default function RegistrationPosterScreen() {
	const { kind: slug = '', id = '' } = useParams<{ kind: string; id: string }>();
	const kind = KIND_BY_SLUG[slug];
	const { t, i18n } = useTranslation();
	const [form, setForm] = useState<RegistrationForm | null>(null);
	const [failed, setFailed] = useState(false);
	const [qr, setQr] = useState('');
	const link = `${window.location.origin}/prihlaska/${slug}/${id}`;

	useDocumentTitle([form?.name, t('registrations.poster.title')]);

	useEffect(() => {
		if (!kind) return;
		registrationApi.getForm(kind, id).then((res) => setForm(res.data)).catch(() => setFailed(true));
		QRCode.toDataURL(link, { width: 720, margin: 1 }).then(setQr).catch(() => setQr(''));
	}, [kind, id, link]);

	if (!kind || failed) {
		return <div className="px-4 py-16 text-center text-muted-foreground">{t('registration.notFound')}</div>;
	}
	if (!form) {
		return <div className="px-4 py-16 text-center text-muted-foreground">{t('common.loading')}</div>;
	}

	const until = formatDeadline(form.deadline, i18n.language);

	return (
		<div className="min-h-screen bg-white text-navy">
			<div className="mx-auto flex max-w-[720px] flex-col items-center gap-6 px-6 py-10 text-center print:py-0">
				<button
					type="button"
					onClick={() => window.print()}
					className="flex h-11 items-center gap-2 self-end rounded-lg bg-navy px-5 text-[15px] font-semibold text-white print:hidden"
				>
					<Printer className="size-4" aria-hidden />{t('registrations.poster.print')}
				</button>
				<span className="text-[15px] font-semibold uppercase tracking-[0.18em] text-slate-500">{form.parentName}</span>
				<h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{form.name}</h1>
				<p className="text-2xl font-bold">{t('registrations.poster.headline')}</p>
				{qr && <img src={qr} alt={t('registrations.share.qrAlt', { name: form.name })} className="size-72 sm:size-80" />}
				<p className="text-lg">{t('registrations.poster.scan')}</p>
				<p className="break-all font-mono text-[15px] text-slate-600">{link}</p>
				<div className="flex flex-col gap-1.5 text-lg">
					{until && <p>{t('registration.deadline', { date: until })}</p>}
					{form.capacity.max != null && <p>{t('registrations.poster.places', { count: form.capacity.max })}</p>}
					{form.fee && <p>{t('registration.fee', { fee: form.fee })}</p>}
				</div>
				{form.sponsors.length > 0 && (
					<div className="flex flex-col items-center gap-3 border-t border-slate-200 pt-6">
						<span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t('plus.band.partners')}</span>
						<div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
							{form.sponsors.map((sponsor) => (
								<img key={sponsor.id} src={sponsor.logo} alt={sponsor.name} className="h-14 w-auto max-w-[180px] object-contain" />
							))}
						</div>
					</div>
				)}
				{/* Every plan's poster names who runs the sign-up, small. */}
				<PoweredByAtm className="mt-2" />
			</div>
		</div>
	);
}
