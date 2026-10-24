import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Panel, TeamCrest } from '@/components/public';
import type { SportProfile } from '@/utils/sportProfiles';
import type { GameDetail } from '@types';

/** Each team's players with what they did, in the numbers the sport keeps. */
export default function PlayerLines({ detail, profile }: { detail: GameDetail; profile: SportProfile }) {
	const { t } = useTranslation();
	const teams = [detail.game.homeTeam, detail.game.awayTeam];
	// Ordered as the season's leaderboard ranks: goals and assists in hockey, points in basketball.
	const total = (line: GameDetail['players'][number]) =>
		(profile.rankBy.length > 0 ? profile.rankBy : profile.stats).reduce((sum, key) => sum + (line[key] ?? 0), 0);

	return (
		<Panel flush title={t('gameDetail.players.title')}>
			<div className="grid sm:grid-cols-2">
				{teams.map((team) => {
					const lines = detail.players
						.filter((line) => line.teamId === team.id)
						.sort((a, b) => total(b) - total(a) || (b.goals ?? 0) - (a.goals ?? 0));
					return (
						<div key={team.id} className="min-w-0 border-border-subtle px-5 pb-4 pt-3 sm:odd:border-r">
							<h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
								<TeamCrest team={team} size={20} />
								{team.name}
							</h3>
							{lines.length === 0 ? (
								<p className="py-2 text-sm text-muted-foreground">{t('gameDetail.players.none')}</p>
							) : (
								<table className="w-full border-collapse text-sm tabular-nums">
									<thead>
										<tr className="text-[11.5px] font-semibold text-muted-foreground">
											<th scope="col" className="border-b border-border py-1.5 text-left">{t('gameDetail.players.player')}</th>
											{profile.stats.map((key) => (
												<th key={key} scope="col" className="w-10 border-b border-border py-1.5 text-center">
													<abbr title={t(`stats.long.${key}`)} className="no-underline">{t(`stats.short.${key}`)}</abbr>
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{lines.map((line) => (
											<tr key={line.player.id}>
												<th scope="row" className="border-b border-border-subtle py-2 text-left font-semibold">
													<span className="inline-block w-7 font-normal text-muted-foreground">{line.player.number ?? ''}</span>
													<Link to={`/players/${line.player.id}`} className="hover:text-primary">{line.player.name}</Link>
												</th>
												{profile.stats.map((key) => (
													<td key={key} className="border-b border-border-subtle py-2 text-center">{line[key] ?? 0}</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					);
				})}
			</div>
		</Panel>
	);
}
