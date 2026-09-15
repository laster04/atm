import { useTranslation } from 'react-i18next';
import type { Player } from '@types';
import { Panel } from '@/components/public';
import { positionLabel } from '@/utils/playerPositions';

/**
 * Public page, so most of a player's row never arrives: the API sends a name
 * and a shirt number to anyone who is not on the team. Each field is rendered
 * only when it is actually there, rather than as a row of dashes announcing
 * what is being withheld.
 */
export default function PlayerInfo({ player }: { player: Player }) {
	const { t } = useTranslation();

	const rows: { label: string; value: React.ReactNode }[] = [
		...(player.number != null ? [{ label: t('playerDetail.info.number'), value: player.number }] : []),
		...(player.position ? [{ label: t('playerDetail.info.position'), value: positionLabel(t, player.position) }] : []),
		...(player.bornYear != null ? [{ label: t('playerDetail.info.bornYear'), value: player.bornYear }] : []),
	];

	return (
		<Panel title={t('playerDetail.info.title')}>
			<dl className="flex flex-col">
				{rows.map((row) => (
					<div key={row.label} className="flex items-center justify-between gap-4 border-b border-border-subtle py-2.5 last:border-0">
						<dt className="text-[13px] text-muted-foreground">{row.label}</dt>
						<dd className="text-sm font-semibold">{row.value}</dd>
					</div>
				))}
				{player.note && (
					<div className="flex flex-col gap-1 pt-3">
						<dt className="text-[13px] text-muted-foreground">{t('playerDetail.info.note')}</dt>
						<dd className="text-sm">{player.note}</dd>
					</div>
				)}
			</dl>
		</Panel>
	);
}
