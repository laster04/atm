import { useTranslation } from 'react-i18next';
import { ClipboardSignature } from 'lucide-react';

/** "Applications open" on a public card: the competition takes team sign-ups right now. */
export default function ApplicationsOpenBadge() {
	const { t } = useTranslation();
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-success-strong">
			<ClipboardSignature className="size-3" aria-hidden />
			{t('registration.openBadge')}
		</span>
	);
}
