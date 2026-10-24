import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Panel, TeamCrest } from '@/components/public';
import type { GameDetail } from '@types';

/**
 * The rows around both teams: each team with its neighbours, gaps closed up.
 * The whole table when it is short.
 */
const excerpt = (rows: GameDetail['table']['rows'], ids: string[]) => {
	if (rows.length <= 6) return rows;
	const keep = new Set<number>();
	rows.forEach((row, index) => {
		if (ids.includes(row.team.id)) [index - 1, index, index + 1].forEach((i) => i >= 0 && i < rows.length && keep.add(i));
	});
	return rows.filter((_, index) => keep.has(index));
};

export default function TableExcerpt({ detail, volleyball }: { detail: GameDetail; volleyball: boolean }) {
	const { t } = useTranslation();
	const ids = [detail.game.homeTeam.id, detail.game.awayTeam.id];
	const rows = excerpt(detail.table.rows, ids);
	const waiting = detail.game.status === 'COMPLETED' && !detail.game.confirmed;
	if (rows.length === 0) return null;

	return (
		<Panel
			flush
			title={detail.table.group ? t('gameDetail.table.groupTitle', { name: detail.table.group.name }) : t('gameDetail.table.title')}
			description={waiting ? t('gameDetail.table.withoutThis') : undefined}
		>
			<table className="w-full border-collapse text-sm tabular-nums">
				<thead>
					<tr className="bg-muted/60 text-[11.5px] font-semibold text-muted-foreground">
						<th scope="col" className="w-10 py-2 pl-5 text-left">#</th>
						<th scope="col" className="py-2 text-left">{t('gameDetail.table.team')}</th>
						<th scope="col" className="w-10 py-2 text-center">{t('seasonDetail.standings.played')}</th>
						{volleyball && <th scope="col" className="w-14 py-2 text-center">{t('gameDetail.table.sets')}</th>}
						<th scope="col" className="w-12 py-2 pr-5 text-right">{t('seasonDetail.standings.points')}</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const mine = ids.includes(row.team.id);
						return (
							<tr
								key={row.team.id}
								className={`border-t border-border-subtle ${mine ? 'bg-accent/60' : ''}`}
								style={mine ? { boxShadow: 'inset 4px 0 0 rgb(var(--primary))' } : undefined}
							>
								<td className="py-2.5 pl-5 font-bold">{row.rank}.</td>
								<th scope="row" className="max-w-0 py-2.5 text-left">
									<span className="flex min-w-0 items-center gap-2">
										<TeamCrest team={row.team} size={20} />
										<span className={`truncate ${mine ? 'font-extrabold' : 'font-semibold'}`}>{row.team.name}</span>
									</span>
								</th>
								<td className="py-2.5 text-center text-subtle-foreground">{row.played}</td>
								{volleyball && <td className="py-2.5 text-center text-subtle-foreground">{row.goalsFor}:{row.goalsAgainst}</td>}
								<td className="py-2.5 pr-5 text-right font-extrabold">{row.points}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			<p className="border-t border-border-subtle px-5 py-3 text-sm">
				<Link to={`/season-detail/${detail.season.id}?tab=standings`} className="font-semibold text-primary hover:underline">
					{t('gameDetail.table.full')}
				</Link>
			</p>
		</Panel>
	);
}
