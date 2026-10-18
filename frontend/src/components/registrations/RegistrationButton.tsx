import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardSignature } from 'lucide-react';
import { registrationApi } from '@/services/api';
import type { RegistrationForm, RegistrationKind } from '@types';
import { formatDeadline } from '@/utils/date';
import { REGISTRATION_SLUG } from './SharePanel';

/**
 * "Apply your team" in a public page's hero, with the terms a captain checks
 * first (deadline, free places, fee). Shown only while the competition takes
 * applications.
 */
export default function RegistrationButton({ kind, id }: { kind: RegistrationKind; id: string }) {
	const { t, i18n } = useTranslation();
	const [form, setForm] = useState<RegistrationForm | null>(null);

	useEffect(() => {
		registrationApi.getForm(kind, id)
			.then((res) => setForm(res.data.state === 'OPEN' ? res.data : null))
			.catch(() => setForm(null));
	}, [kind, id]);

	if (!form) return null;
	const until = formatDeadline(form.deadline, i18n.language);
	const facts = [
		until && t('registration.deadline', { date: until }),
		form.capacity.max != null && (form.capacity.free
			? t('registration.freePlaces', { count: form.capacity.free, max: form.capacity.max })
			: t('registration.waitlistOnly')),
		form.fee && t('registration.fee', { fee: form.fee }),
	].filter(Boolean) as string[];

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-3">
				<Link
					to={`/prihlaska/${REGISTRATION_SLUG[kind]}/${id}`}
					className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-[15px] font-semibold text-navy shadow-sm hover:bg-white/90"
				>
					<ClipboardSignature className="size-4" aria-hidden />
					{t('registration.applyButton')}
				</Link>
				<span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide text-white">
					{t('registration.openBadge')}
				</span>
			</div>
			{facts.length > 0 && <p className="text-[13px] text-white/85">{facts.join(' · ')}</p>}
		</div>
	);
}
