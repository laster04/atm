import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardSignature } from 'lucide-react';
import { registrationApi } from '@/services/api';
import type { RegistrationKind } from '@types';

const SLUG: Record<RegistrationKind, string> = { season: 'sezona', tournament: 'turnaj' };

/** "Přihlásit tým" in a public page's hero, shown only while the competition takes applications. */
export default function RegistrationButton({ kind, id }: { kind: RegistrationKind; id: string }) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);

	useEffect(() => {
		registrationApi.getForm(kind, id)
			.then((res) => setOpen(res.data.state === 'OPEN'))
			.catch(() => setOpen(false));
	}, [kind, id]);

	if (!open) return null;
	return (
		<Link
			to={`/prihlaska/${SLUG[kind]}/${id}`}
			className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-[15px] font-semibold text-navy shadow-sm hover:bg-white/90"
		>
			<ClipboardSignature className="size-4" aria-hidden />
			{t('registration.applyButton')}
		</Link>
	);
}
