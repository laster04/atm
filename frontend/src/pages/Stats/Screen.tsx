import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { gameStatisticApi, leagueApi, seasonApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { League, Season, TopScorer } from '@types';
import { EmptyState, PublicHero, TeamCrest } from '@/components/public';

/** Gold, silver, bronze for the first three; the rest share the quiet chip. */
const MEDALS = ['bg-brand text-brand-ink', 'bg-border text-subtle-foreground', 'bg-warning-soft text-warning-strong'];

export default function StatsScreen() {
	const { t } = useTranslation();
	const [scorers, setScorers] = useState<TopScorer[]>([]);
	const [leagues, setLeagues] = useState<League[]>([]);
	const [seasons, setSeasons] = useState<Season[]>([]);
	const [leagueId, setLeagueId] = useState('');
	const [seasonId, setSeasonId] = useState('');
	const [loading, setLoading] = useState(true);

	useDocumentTitle([t('public.stats.title')]);

	useEffect(() => {
		Promise.all([leagueApi.getAll(), seasonApi.getAll()])
			.then(([leagueRes, seasonRes]) => {
				setLeagues(leagueRes.data);
				setSeasons(seasonRes.data);
			})
			.catch((error) => console.error(error));
	}, []);

	useEffect(() => {
		setLoading(true);
		gameStatisticApi.getTopScorers({
			leagueId: leagueId || undefined,
			seasonId: seasonId || undefined,
			limit: 50,
		})
			.then((res) => setScorers(res.data))
			.catch((error) => console.error(error))
			.finally(() => setLoading(false));
	}, [leagueId, seasonId]);

	// Picking a league narrows which seasons can be chosen; picking a season of
	// another league would otherwise contradict the league filter.
	const seasonOptions = leagueId ? seasons.filter((season) => season.leagueId === leagueId) : seasons;

	return (
		<>
			<PublicHero
				kicker={t('public.hero.kicker')}
				title={t('public.stats.title')}
				subtitle={t('public.stats.subtitle')}
				crumbs={[{ label: t('public.nav.home'), to: '/' }, { label: t('public.stats.title') }]}
			/>

			<div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-7 sm:px-8">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<select
						value={leagueId}
						onChange={(event) => { setLeagueId(event.target.value); setSeasonId(''); }}
						aria-label={t('public.teams.leagueFilter')}
						className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-subtle-foreground outline-none sm:w-56"
					>
						<option value="">{t('public.teams.allLeagues')}</option>
						{leagues.map((league) => (
							<option key={league.id} value={league.id}>{league.name}</option>
						))}
					</select>
					<select
						value={seasonId}
						onChange={(event) => setSeasonId(event.target.value)}
						aria-label={t('public.stats.seasonFilter')}
						className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-subtle-foreground outline-none sm:w-56"
					>
						<option value="">{t('public.stats.allSeasons')}</option>
						{seasonOptions.map((season) => (
							<option key={season.id} value={season.id}>{season.name}</option>
						))}
					</select>
					<span className="text-sm text-muted-foreground sm:ml-auto">{t('public.stats.scope')}</span>
				</div>

				{loading ? (
					<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
				) : scorers.length === 0 ? (
					<EmptyState
						icon={<BarChart3 className="size-7" />}
						title={t('public.stats.empty')}
						hint={t('public.stats.emptyHint')}
					/>
				) : (
					<>
						<div className="grid gap-5 sm:grid-cols-3">
							{scorers.slice(0, 3).map((scorer, index) => (
								<div
									key={scorer.player.id}
									className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
								>
									<span className={`flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-extrabold ${MEDALS[index]}`}>
										{index + 1}
									</span>
									<div className="flex min-w-0 flex-col gap-0.5">
										<Link to={`/players/${scorer.player.id}`} className="truncate font-bold hover:text-primary">
											{scorer.player.name}
										</Link>
										<span className="truncate text-[13px] text-subtle-foreground">
											{scorer.player.team?.name}
										</span>
									</div>
									<div className="ml-auto flex flex-col items-end">
										<span className="text-2xl font-extrabold leading-none">{scorer.points}</span>
										<span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
											{t('seasonDetail.overview.pointsShort')}
										</span>
									</div>
								</div>
							))}
						</div>

						<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
							<div className="border-b border-border px-5 py-4 text-[17px] font-bold">
								{t('public.stats.tableTitle')}
							</div>
							<div className="overflow-x-auto">
								<table className="w-full min-w-[680px] border-collapse">
									<thead>
										<tr className="bg-muted/60">
											<th className="w-14 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
											<th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('public.players.player')}</th>
											<th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('public.players.team')}</th>
											<th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('seasonDetail.playersStats.gamesPlayed')}</th>
											<th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('seasonDetail.playersStats.goals')}</th>
											<th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('seasonDetail.playersStats.assists')}</th>
											<th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('seasonDetail.playersStats.penaltyMinutes')}</th>
											<th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-foreground">{t('seasonDetail.playersStats.points')}</th>
										</tr>
									</thead>
									<tbody>
										{scorers.map((scorer, index) => (
											<tr
												key={scorer.player.id}
												className="border-t border-border-subtle transition-colors hover:bg-muted/50"
												style={{ boxShadow: `inset 4px 0 0 ${scorer.player.team?.primaryColor || 'transparent'}` }}
											>
												<td className="px-3 py-3 text-center text-[13px] font-bold">{index + 1}</td>
												<td className="px-3 py-3 text-[13px]">
													<Link to={`/players/${scorer.player.id}`} className="font-semibold hover:text-primary">
														{scorer.player.name}
													</Link>
													{scorer.player.number != null && (
														<span className="ml-2 text-xs text-muted-foreground">#{scorer.player.number}</span>
													)}
												</td>
												<td className="px-3 py-3 text-[13px]">
													{scorer.player.team && (
														<Link to={`/teams/${scorer.player.team.id}`} className="flex items-center gap-2.5 text-subtle-foreground hover:text-foreground">
															<TeamCrest team={scorer.player.team} size={24} />
															<span className="truncate">{scorer.player.team.name}</span>
														</Link>
													)}
												</td>
												<td className="px-3 py-3 text-center text-[13px]">{scorer.gamesPlayed}</td>
												<td className="px-3 py-3 text-center text-[13px]">{scorer.goals}</td>
												<td className="px-3 py-3 text-center text-[13px]">{scorer.assists}</td>
												<td className="px-3 py-3 text-center text-[13px]">{scorer.penaltyMinutes}</td>
												<td className="px-3 py-3 text-center text-[15px] font-extrabold">{scorer.points}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</>
				)}
			</div>
		</>
	);
}
