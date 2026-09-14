import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { gameApi, leagueApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDateShort } from '@/utils/date';
import type { Game, League, PublicGameQuery } from '@types';
import { EmptyState, PublicHero } from '@/components/public';
import FilterTabs, { type FilterTab } from '@/components/public/FilterTabs';
import GameRow from './components/GameRow';

const PAGE_SIZE = 40;
type Scope = NonNullable<PublicGameQuery['scope']>;

export default function GamesScreen() {
	const { t, i18n } = useTranslation();
	const [scope, setScope] = useState<Scope>('upcoming');
	const [games, setGames] = useState<Game[]>([]);
	const [total, setTotal] = useState(0);
	const [leagues, setLeagues] = useState<League[]>([]);
	const [leagueId, setLeagueId] = useState('');
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);

	useDocumentTitle([t('public.games.title')]);

	useEffect(() => {
		leagueApi.getAll()
			.then((res) => setLeagues(res.data))
			.catch((error) => console.error(error));
	}, []);

	useEffect(() => {
		setLoading(true);
		gameApi.getPublic({ scope, leagueId: leagueId || undefined, take: PAGE_SIZE })
			.then((res) => {
				setGames(res.data.items);
				setTotal(res.data.total);
			})
			.catch((error) => console.error(error))
			.finally(() => setLoading(false));
	}, [scope, leagueId]);

	const loadMore = () => {
		setLoadingMore(true);
		gameApi.getPublic({ scope, leagueId: leagueId || undefined, take: PAGE_SIZE, skip: games.length })
			.then((res) => setGames((current) => [...current, ...res.data.items]))
			.catch((error) => console.error(error))
			.finally(() => setLoadingMore(false));
	};

	// A schedule reads as days, not as one long list, so rows are grouped by the
	// date they fall on and undated fixtures collect under one heading.
	const days = useMemo(() => {
		const groups = new Map<string, Game[]>();
		for (const game of games) {
			const key = game.date ? game.date.slice(0, 10) : '';
			const bucket = groups.get(key);
			if (bucket) bucket.push(game);
			else groups.set(key, [game]);
		}
		return Array.from(groups.entries());
	}, [games]);

	const tabs: FilterTab<Scope>[] = [
		{ value: 'upcoming', label: t('public.games.scope.upcoming') },
		{ value: 'live', label: t('public.games.scope.live'), dot: 'rgb(var(--destructive))' },
		{ value: 'results', label: t('public.games.scope.results') },
	];

	return (
		<>
			<PublicHero
				kicker={t('public.hero.kicker')}
				title={t('public.games.title')}
				subtitle={t('public.games.subtitle')}
				crumbs={[{ label: t('public.nav.home'), to: '/' }, { label: t('public.games.title') }]}
			/>

			<div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-7 sm:px-8">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<FilterTabs tabs={tabs} value={scope} onChange={setScope} />
					<select
						value={leagueId}
						onChange={(event) => setLeagueId(event.target.value)}
						aria-label={t('public.teams.leagueFilter')}
						className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-subtle-foreground outline-none sm:ml-auto sm:w-56"
					>
						<option value="">{t('public.teams.allLeagues')}</option>
						{leagues.map((league) => (
							<option key={league.id} value={league.id}>{league.name}</option>
						))}
					</select>
					<span className="text-sm text-muted-foreground">
						{t('public.games.count', { count: total })}
					</span>
				</div>

				{loading ? (
					<div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
				) : games.length === 0 ? (
					<EmptyState
						icon={<CalendarDays className="size-7" />}
						title={t(`public.games.empty.${scope}`)}
						hint={t('public.games.emptyHint')}
					/>
				) : (
					<>
						<div className="flex flex-col gap-5">
							{days.map(([day, dayGames]) => (
								<div key={day || 'undated'} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
									<div className="flex items-center gap-3 border-b border-border bg-muted/50 px-5 py-3">
										<CalendarDays className="size-4 text-muted-foreground" />
										<h2 className="text-sm font-bold">
											{day ? formatDateShort(day, i18n.language) : t('public.games.undated')}
										</h2>
										<span className="ml-auto text-xs text-muted-foreground">
											{t('public.games.count', { count: dayGames.length })}
										</span>
									</div>
									{dayGames.map((game) => (
										<GameRow key={game.id} game={game} />
									))}
								</div>
							))}
						</div>
						{games.length < total && (
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
