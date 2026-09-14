import { useTranslation } from 'react-i18next';
import type { Player } from '@types';
import { Panel } from '@/components/public';

export default function PlayerInfo({ player }: { player: Player }) {
	const { t } = useTranslation();

	const rows: { label: string; value: React.ReactNode }[] = [
		{ label: t('playerDetail.info.number'), value: player.number ?? '—' },
		{ label: t('playerDetail.info.position'), value: player.position || '—' },
		{ label: t('playerDetail.info.bornYear'), value: player.bornYear ?? '—' },
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
