import { useTranslation } from 'react-i18next';
import { Panel } from '@/components/public';
import type { GameDetail } from '@types';

/** Volleyball: every set's points, and the balls they add up to. */
export default function SetsPanel({ game }: { game: GameDetail['game'] }) {
	const { t } = useTranslation();
	const sets = game.periodScores ?? [];
	const balls = sets.reduce((sum, set) => ({ home: sum.home + set.home, away: sum.away + set.away }), { home: 0, away: 0 });
	const cell = (mine: number, theirs: number) =>
		`py-2.5 text-center tabular-nums ${mine > theirs ? 'font-extrabold text-foreground' : 'text-muted-foreground'}`;

	return (
		<Panel flush title={t('sports.partsTitle.SET')}>
			<table className="w-full border-collapse text-[15px]">
				<thead>
					<tr className="bg-muted/60 text-[11.5px] font-semibold text-muted-foreground">
						<th scope="col" className="px-5 py-2 text-left">{t('gameDetail.sets.set')}</th>
						<th scope="col" className="truncate py-2 text-center">{game.homeTeam.name}</th>
						<th scope="col" className="truncate py-2 pr-5 text-center">{game.awayTeam.name}</th>
					</tr>
				</thead>
				<tbody>
					{sets.map((set, index) => (
						<tr key={index} className="border-t border-border-subtle">
							<th scope="row" className="px-5 py-2.5 text-left font-semibold text-subtle-foreground">{t('sports.parts.SET', { n: index + 1 })}</th>
							<td className={cell(set.home, set.away)}>{set.home}</td>
							<td className={`${cell(set.away, set.home)} pr-5`}>{set.away}</td>
						</tr>
					))}
					<tr className="border-t-2 border-border bg-muted/40 font-bold">
						<th scope="row" className="px-5 py-2.5 text-left">{t('gameDetail.sets.balls')}</th>
						<td className="py-2.5 text-center tabular-nums">{balls.home}</td>
						<td className="py-2.5 pr-5 text-center tabular-nums">{balls.away}</td>
					</tr>
				</tbody>
			</table>
		</Panel>
	);
}
