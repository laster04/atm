import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { Season } from '@types';
import EmbedPanel from '@/components/embed/EmbedPanel';
import { SEASON_ACCENT } from './util';

/** The season's table and games for the league's or a club's website. */
export default function EmbedSheet({ season, onClose }: { season: Season; onClose: () => void }) {
	const { t } = useTranslation();
	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-background">
			<div className="tm-team-header shrink-0 text-white shadow-md" style={{ backgroundColor: SEASON_ACCENT }}>
				<div className="flex items-center gap-3 px-4 py-3">
					<button onClick={onClose} className="-ml-2 flex size-10 items-center justify-center rounded-lg" aria-label={t('common.close')}>
						<X className="size-5" aria-hidden />
					</button>
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-lg font-bold">{t('embedPanel.title')}</h1>
						<p className="truncate text-xs text-white/85">{season.name}</p>
					</div>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto p-4">
				<EmbedPanel kind="season" id={season.id} accent={SEASON_ACCENT} />
			</div>
		</div>
	);
}
