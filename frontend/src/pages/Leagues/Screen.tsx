import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Trophy } from 'lucide-react';
import { leagueApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { SportType, type League } from '@types';
import { EmptyState, FilterTabs, PublicHero, type FilterTab } from '@/components/public';
import LeagueCard from './components/LeagueCard';

type Filter = 'all' | SportType;

export default function LeaguesScreen() {
	const { t } = useTranslation();
	const [filter, setFilter] = useState<Filter>('all');
	const [search, setSearch] = useState('');
	const [leagues, setLeagues] = useState<League[]>([]);
	const [loading, setLoading] = useState(true);

	useDocumentTitle([t('public.nav.leagues')]);

	useEffect(() => {
		leagueApi.getAll()
			.then((res) => setLeagues(res.data))
			.catch((error) => console.error(error))
			.finally(() => setLoading(false));
	}, []);

	// Only the sports actually in use get a pill; an empty filter helps nobody.
	const tabs: FilterTab<Filter>[] = [
		{ value: 'all', label: t('leagues.filter.all') },
		...Array.from(new Set(leagues.map((league) => league.sportType))).map((sport) => ({
			value: sport as Filter,
			label: t(`sports.${sport}`),
		})),
	];

	const visible = useMemo(() => {
		const term = search.trim().toLowerCase();
		return leagues.filter((league) => {
			if (filter !== 'all' && league.sportType !== filter) return false;
			if (!term) return true;
			return (
				league.name.toLowerCase().includes(term) ||
				(league.description ?? '').toLowerCase().includes(term)
			);
		});
	}, [leagues, filter, search]);

	return (
		<>
			<PublicHero
				kicker={t('public.hero.kicker')}
				title={t('public.leagues.title')}
				subtitle={t('public.leagues.subtitle')}
				crumbs={[{ label: t('public.nav.home'), to: '/' }, { label: t('public.nav.leagues') }]}
				sport={leagues[0]?.sportType}
			/>

			<div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-7 sm:px-8">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					{tabs.length > 2 && <FilterTabs tabs={tabs} value={filter} onChange={setFilter} />}
					<div className="flex h-10 items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 sm:ml-auto sm:w-64">
						<Search className="size-4 shrink-0 text-muted-foreground" />
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t('public.leagues.searchPlaceholder')}
							aria-label={t('public.leagues.searchPlaceholder')}
							className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						/>
					</div>
				</div>

				{loading ? (
					<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
						{[0, 1, 2].map((key) => (
							<div key={key} className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
						))}
					</div>
				) : visible.length === 0 ? (
					<EmptyState
						icon={<Trophy className="size-7" />}
						title={t('leagues.noLeagues')}
						hint={t('public.leagues.emptyHint')}
					/>
				) : (
					<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
						{visible.map((league) => (
							<LeagueCard key={league.id} league={league} />
						))}
					</div>
				)}
			</div>
		</>
	);
}
