import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, UserRound } from 'lucide-react';
import { leagueApi, playerApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { League, PublicPlayer } from '@types';
import { EmptyState, PublicHero, TeamCrest } from '@/components/public';
import FilterTabs, { type FilterTab } from '@/components/public/FilterTabs';
import { positionLabel } from '@/utils/playerPositions';

const PAGE_SIZE = 40;
type Sort = 'points' | 'name';

export default function PlayersScreen() {
	const { t } = useTranslation();
	const [players, setPlayers] = useState<PublicPlayer[]>([]);
	const [total, setTotal] = useState(0);
	const [leagues, setLeagues] = useState<League[]>([]);
	const [leagueId, setLeagueId] = useState('');
	const [search, setSearch] = useState('');
	const [sort, setSort] = useState<Sort>('points');
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);

	useDocumentTitle([t('public.players.title')]);

	useEffect(() => {
		leagueApi.getAll()
			.then((res) => setLeagues(res.data))
			.catch((error) => console.error(error));
	}, []);

	useEffect(() => {
		setLoading(true);
		const timer = setTimeout(() => {
			playerApi.getPublic({
				search: search.trim() || undefined,
				leagueId: leagueId || undefined,
				sort,
				take: PAGE_SIZE,
			})
				.then((res) => {
					setPlayers(res.data.items);
					setTotal(res.data.total);
				})
				.catch((error) => console.error(error))
				.finally(() => setLoading(false));
		}, 250);
		return () => clearTimeout(timer);
	}, [search, leagueId, sort]);

	const loadMore = () => {
		setLoadingMore(true);
		playerApi.getPublic({
			search: search.trim() || undefined,
			leagueId: leagueId || undefined,
			sort,
			take: PAGE_SIZE,
			skip: players.length,
		})
			.then((res) => setPlayers((current) => [...current, ...res.data.items]))
			.catch((error) => console.error(error))
			.finally(() => setLoadingMore(false));
	};

	const tabs: FilterTab<Sort>[] = [
		{ value: 'points', label: t('public.players.sortPoints') },
		{ value: 'name', label: t('public.players.sortName') },
	];

	return (
		<>
			<PublicHero
				kicker={t('public.hero.kicker')}
				title={t('public.players.title')}
				subtitle={t('public.players.subtitle')}
				crumbs={[{ label: t('public.nav.home'), to: '/' }, { label: t('public.players.title') }]}
			/>

			<div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-7 sm:px-8">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
					<FilterTabs tabs={tabs} value={sort} onChange={setSort} />
					<div className="flex h-10 items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 lg:ml-auto lg:w-64">
						<Search className="size-4 shrink-0 text-muted-foreground" />
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t('public.players.searchPlaceholder')}
							aria-label={t('public.players.searchPlaceholder')}
							className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						/>
					</div>
					<select
						value={leagueId}
						onChange={(event) => setLeagueId(event.target.value)}
						aria-label={t('public.teams.leagueFilter')}
						className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-subtle-foreground outline-none lg:w-56"
					>
						<option value="">{t('public.teams.allLeagues')}</option>
						{leagues.map((league) => (
							<option key={league.id} value={league.id}>{league.name}</option>
						))}
					</select>
				</div>

				{loading ? (
					<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
				) : players.length === 0 ? (
					<EmptyState
						icon={<UserRound className="size-7" />}
						title={t('public.players.empty')}
						hint={t('public.players.emptyHint')}
					/>
				) : (
					<>
						<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
							<div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
								<h2 className="text-[17px] font-bold">{t('public.players.tableTitle')}</h2>
								<span className="text-sm text-muted-foreground">
									{t('public.players.count', { count: total })}
								</span>
							</div>
							{/* Narrow screens scroll the columns rather than dropping them. */}
							<div className="overflow-x-auto">
								<table className="w-full min-w-[720px] border-collapse">
									<thead>
										<tr className="bg-muted/60">
											<Th className="w-14 text-center">#</Th>
											<Th className="text-left">{t('public.players.player')}</Th>
											<Th className="text-left">{t('public.players.team')}</Th>
											<Th className="text-center">{t('seasonDetail.playersStats.gamesPlayed')}</Th>
											<Th className="text-center">{t('seasonDetail.playersStats.goals')}</Th>
											<Th className="text-center">{t('seasonDetail.playersStats.assists')}</Th>
											<Th className="text-center">{t('seasonDetail.playersStats.penaltyMinutes')}</Th>
											<Th className="text-center text-foreground">{t('seasonDetail.playersStats.points')}</Th>
										</tr>
									</thead>
									<tbody>
										{players.map((player, index) => (
											<tr
												key={player.id}
												className="border-t border-border-subtle transition-colors hover:bg-muted/50"
												style={{ boxShadow: `inset 4px 0 0 ${player.team.primaryColor || 'transparent'}` }}
											>
												<Td className="text-center font-bold">
													{sort === 'points' ? index + 1 : (player.number ?? '—')}
												</Td>
												<Td className="text-left">
													<Link to={`/players/${player.id}`} className="font-semibold text-foreground hover:text-primary">
														{player.name}
													</Link>
													{player.position && (
														<span className="ml-2 text-xs text-muted-foreground">{positionLabel(t, player.position)}</span>
													)}
												</Td>
												<Td className="text-left">
													<Link to={`/teams/${player.team.id}`} className="flex items-center gap-2.5 text-subtle-foreground hover:text-foreground">
														<TeamCrest team={player.team} size={24} />
														<span className="truncate">{player.team.name}</span>
													</Link>
												</Td>
												<Td className="text-center">{player.stats.gamesPlayed}</Td>
												<Td className="text-center">{player.stats.goals}</Td>
												<Td className="text-center">{player.stats.assists}</Td>
												<Td className="text-center">{player.stats.penaltyMinutes}</Td>
												<Td className="text-center text-[15px] font-extrabold">{player.stats.points}</Td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
						{players.length < total && (
							<button
								type="button"
								onClick={loadMore}
								disabled={loadingMore}
								className="mx-auto flex h-11 items-center rounded-xl border border-border bg-card px-6 text-sm font-semibold shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
							>
								{loadingMore ? t('common.loading') : t('public.loadMore')}
							</button>
						)}
					</>
				)}
			</div>
		</>
	);
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
	return (
		<th className={`px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground ${className}`}>
			{children}
		</th>
	);
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
	return <td className={`px-3 py-3 text-[13px] ${className}`}>{children}</td>;
}
