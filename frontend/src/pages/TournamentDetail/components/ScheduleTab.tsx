import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import type { Tournament, TournamentGame } from '@types';
import { EmptyState, FilterTabs, GameStatusBadge, Panel } from '@/components/public';
import { formatDateShort, formatGameTime } from '@/utils/date';
import { isPlayed } from './shared';

interface ScheduleTabProps {
	tournament: Tournament;
}

/**
 * The group games in blocks by start time. Games carry no round number, and the
 * schedule generator starts a round's games together on every court, so the
 * start time is what a player actually looks for.
 */
export default function ScheduleTab({ tournament }: ScheduleTabProps) {
	const { t, i18n } = useTranslation();
	const groups = tournament.groups ?? [];
	const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
	const group = groups.find((item) => item.id === groupId) ?? groups[0];

	const games = (tournament.games ?? []).filter(
		(game) => game.phase === 'GROUP' && (!group || game.groupId === group.id)
	);

	if (games.length === 0) {
		return (
			<div className="flex flex-col gap-5">
				{groups.length > 1 && <GroupPills groups={groups} value={group?.id ?? ''} onChange={setGroupId} />}
				<EmptyState title={t('tournamentDetail.schedule.empty')} />
			</div>
		);
	}

	const blocks = new Map<string, TournamentGame[]>();
	for (const game of [...games].sort(byStart)) {
		const key = game.date ?? '';
		blocks.set(key, [...(blocks.get(key) ?? []), game]);
	}

	return (
		<div className="flex flex-col gap-5">
			{groups.length > 1 && <GroupPills groups={groups} value={group.id} onChange={setGroupId} />}
			<div className="grid items-start gap-5 lg:grid-cols-2">
				{[...blocks.entries()].map(([start, blockGames]) => (
					<Panel
						key={start || 'undated'}
						className={blocks.size === 1 ? 'lg:col-span-2' : ''}
						flush
						title={start ? formatGameTime(start, i18n.language) : t('tournamentDetail.schedule.undated')}
						action={
							start ? (
								<span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
									<Clock className="size-3.5" />
									{formatDateShort(start, i18n.language)}
								</span>
							) : undefined
						}
					>
						{blockGames.map((game, index) => (
							<GameRow key={game.id} game={game} first={index === 0} />
						))}
					</Panel>
				))}
			</div>
		</div>
	);
}

const byStart = (a: TournamentGame, b: TournamentGame): number => {
	if (!a.date && !b.date) return (a.location ?? '').localeCompare(b.location ?? '');
	if (!a.date) return 1;
	if (!b.date) return -1;
	return a.date.localeCompare(b.date) || (a.location ?? '').localeCompare(b.location ?? '');
};

function GroupPills({
	groups,
	value,
	onChange,
}: {
	groups: NonNullable<Tournament['groups']>;
	value: string;
	onChange: (id: string) => void;
}) {
	const { t } = useTranslation();
	return (
		<FilterTabs
			className="self-start"
			tabs={groups.map((item) => ({ value: item.id, label: t('tournamentDetail.groups.groupLabel', { name: item.name }) }))}
			value={value}
			onChange={onChange}
		/>
	);
}

function GameRow({ game, first }: { game: TournamentGame; first: boolean }) {
	const { t } = useTranslation();
	const played = isPlayed(game);
	const homeWon = played && game.homeScore! > game.awayScore!;
	const awayWon = played && game.awayScore! > game.homeScore!;
	const side = (won: boolean) =>
		`min-w-0 flex-1 truncate text-[13px] ${won || !played ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`;

	return (
		<div className={`flex items-center gap-3 px-5 py-3 ${first ? '' : 'border-t border-border-subtle'}`}>
			<span className="hidden w-14 shrink-0 truncate text-xs text-muted-foreground sm:block">{game.location}</span>
			<span className={`${side(homeWon)} text-right`}>{game.homeTeam?.name ?? t('tm.common.tbd')}</span>
			{played ? (
				<span className="min-w-[56px] shrink-0 rounded-lg bg-muted px-2.5 py-1 text-center text-sm font-extrabold tabular-nums">
					{game.homeScore}:{game.awayScore}
				</span>
			) : game.status === 'SCHEDULED' ? (
				<span className="min-w-[56px] shrink-0 text-center text-xs font-semibold text-muted-foreground">
					{t('tournamentDetail.schedule.vs')}
				</span>
			) : (
				<span className="shrink-0">
					<GameStatusBadge status={game.status} />
				</span>
			)}
			<span className={`${side(awayWon)} text-left`}>{game.awayTeam?.name ?? t('tm.common.tbd')}</span>
		</div>
	);
}
