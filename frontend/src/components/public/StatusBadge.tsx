import { useTranslation } from 'react-i18next';
import { GameStatus, SeasonStatus } from '@types';

/**
 * One badge shape for both kinds of status, so a season pill and a fixture pill
 * read as the same family. Tones come from the palette's soft/strong pairs.
 */
const SEASON_TONE: Record<SeasonStatus, string> = {
	[SeasonStatus.ACTIVE]: 'bg-success-soft text-success-strong',
	[SeasonStatus.COMPLETED]: 'bg-accent text-accent-foreground',
	[SeasonStatus.DRAFT]: 'bg-muted text-subtle-foreground',
};

const GAME_TONE: Record<string, string> = {
	[GameStatus.SCHEDULED]: 'bg-accent text-accent-foreground',
	[GameStatus.IN_PROGRESS]: 'bg-destructive-soft text-destructive-strong',
	[GameStatus.COMPLETED]: 'bg-muted text-subtle-foreground',
	[GameStatus.POSTPONED]: 'bg-warning-soft text-warning-strong',
	[GameStatus.CANCELLED]: 'bg-destructive-soft text-destructive-strong',
};

const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide';

export function SeasonStatusBadge({ status, archived }: { status: SeasonStatus; archived?: boolean }) {
	const { t } = useTranslation();
	if (archived) {
		return <span className={`${base} bg-warning-soft text-warning-strong`}>{t('seasons.archived')}</span>;
	}
	return <span className={`${base} ${SEASON_TONE[status]}`}>{t(`seasons.status.${status}`)}</span>;
}

export function GameStatusBadge({ status }: { status: GameStatus }) {
	const { t } = useTranslation();
	const live = status === GameStatus.IN_PROGRESS;
	return (
		<span className={`${base} ${GAME_TONE[status] ?? GAME_TONE[GameStatus.SCHEDULED]}`}>
			{live && <span className="size-1.5 animate-pulse rounded-full bg-destructive-strong" />}
			{t(`public.games.status.${status}`)}
		</span>
	);
}
