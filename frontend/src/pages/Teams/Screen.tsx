import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Users } from 'lucide-react';
import { leagueApi, teamApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { League, PublicTeam } from '@types';
import { EmptyState, PublicHero } from '@/components/public';
import TeamCard from './components/TeamCard';

const PAGE_SIZE = 24;

export default function TeamsScreen() {
	const { t } = useTranslation();
	const [teams, setTeams] = useState<PublicTeam[]>([]);
	const [total, setTotal] = useState(0);
	const [leagues, setLeagues] = useState<League[]>([]);
	const [leagueId, setLeagueId] = useState('');
	const [search, setSearch] = useState('');
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);

	useDocumentTitle([t('public.teams.title')]);

	useEffect(() => {
		leagueApi.getAll()
			.then((res) => setLeagues(res.data))
			.catch((error) => console.error(error));
	}, []);

	// Typing is debounced: the directory is a server query, not a local filter.
	useEffect(() => {
		setLoading(true);
		const timer = setTimeout(() => {
			teamApi.getPublic({
				search: search.trim() || undefined,
				leagueId: leagueId || undefined,
				take: PAGE_SIZE,
			})
				.then((res) => {
					setTeams(res.data.items);
					setTotal(res.data.total);
				})
				.catch((error) => console.error(error))
				.finally(() => setLoading(false));
		}, 250);
		return () => clearTimeout(timer);
	}, [search, leagueId]);

	const loadMore = () => {
		setLoadingMore(true);
		teamApi.getPublic({
			search: search.trim() || undefined,
			leagueId: leagueId || undefined,
			take: PAGE_SIZE,
			skip: teams.length,
		})
			.then((res) => setTeams((current) => [...current, ...res.data.items]))
			.catch((error) => console.error(error))
			.finally(() => setLoadingMore(false));
	};

	return (
		<>
			<PublicHero
				kicker={t('public.hero.kicker')}
				title={t('public.teams.title')}
				subtitle={t('public.teams.subtitle')}
				crumbs={[{ label: t('public.nav.home'), to: '/' }, { label: t('public.teams.title') }]}
			/>

			<div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-7 sm:px-8">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="flex h-10 items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 sm:w-72">
						<Search className="size-4 shrink-0 text-muted-foreground" />
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t('public.teams.searchPlaceholder')}
							aria-label={t('public.teams.searchPlaceholder')}
							className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						/>
					</div>
					<select
						value={leagueId}
						onChange={(event) => setLeagueId(event.target.value)}
						aria-label={t('public.teams.leagueFilter')}
						className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-subtle-foreground outline-none sm:w-56"
					>
						<option value="">{t('public.teams.allLeagues')}</option>
						{leagues.map((league) => (
							<option key={league.id} value={league.id}>{league.name}</option>
						))}
					</select>
					<span className="text-sm text-muted-foreground sm:ml-auto">
						{t('public.teams.count', { count: total })}
					</span>
				</div>

				{loading ? (
					<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
						{[0, 1, 2, 3].map((key) => (
							<div key={key} className="h-36 animate-pulse rounded-2xl border border-border bg-card" />
						))}
					</div>
				) : teams.length === 0 ? (
					<EmptyState
						icon={<Users className="size-7" />}
						title={t('public.teams.empty')}
						hint={t('public.teams.emptyHint')}
					/>
				) : (
					<>
						<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
							{teams.map((team) => (
								<TeamCard key={team.id} team={team} />
							))}
						</div>
						{teams.length < total && (
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
