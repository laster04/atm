import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Panel } from '@/components/public';
import { formatDateShort } from '@/utils/date';
import type { GameDetail } from '@types';

/** The two teams' other games this season, each linking to its own page. */
export default function Meetings({ detail }: { detail: GameDetail }) {
	const { t, i18n } = useTranslation();
	const names = new Map([detail.game.homeTeam, detail.game.awayTeam].map((team) => [team.id, team.name]));

	return (
		<Panel flush title={t('gameDetail.meetings.title')}>
			<ul>
				{detail.headToHead.map((meeting) => {
					const scored = meeting.homeScore != null && meeting.awayScore != null && meeting.status !== 'SCHEDULED';
					return (
						<li key={meeting.id} className="border-t border-border-subtle first:border-0">
							<Link to={`/games/${meeting.id}`} className="flex min-h-[52px] items-center gap-3 px-5 py-2.5 hover:bg-muted/50">
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="text-xs text-muted-foreground">
										{formatDateShort(meeting.date, i18n.language) ?? t('gameDetail.meetings.noDate')}
									</span>
									<span className="truncate text-sm font-semibold">
										{names.get(meeting.homeTeamId)} – {names.get(meeting.awayTeamId)}
									</span>
								</span>
								<span className="shrink-0 text-base font-extrabold tabular-nums">
									{scored ? `${meeting.homeScore}:${meeting.awayScore}` : t('gameDetail.meetings.upcoming')}
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</Panel>
	);
}
