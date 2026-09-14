import { useTranslation } from 'react-i18next';
import { Link2, Lock } from 'lucide-react';
import { Visibility } from '@types';

const TONE: Record<Exclude<Visibility, Visibility.PUBLIC>, string> = {
	[Visibility.UNLISTED]: 'bg-warning-soft text-warning-strong',
	[Visibility.PRIVATE]: 'bg-destructive-soft text-destructive-strong',
};

/**
 * Marks something hidden from the public, wherever it is shown to someone who
 * can still see it - so a manager is never unsure whether the page in front of
 * them is the one visitors get. Public things carry no mark at all.
 *
 * Pass the effective level (see utils/visibility), not the record's own: a
 * public season in a private league is private.
 */
export default function VisibilityBadge({ visibility }: { visibility?: Visibility | null }) {
	const { t } = useTranslation();
	if (!visibility || visibility === Visibility.PUBLIC) return null;

	const Icon = visibility === Visibility.PRIVATE ? Lock : Link2;
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${TONE[visibility]}`}
			title={t(`visibility.hints.${visibility}`)}
		>
			<Icon className="size-3" aria-hidden />
			{t(`visibility.levels.${visibility}`)}
		</span>
	);
}
