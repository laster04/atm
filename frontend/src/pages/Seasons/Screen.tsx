import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Search } from 'lucide-react';
import { seasonApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { SeasonStatus, SportType, type Season } from '@types';
import { EmptyState, PublicHero } from '@/components/public';
import FilterTabs, { type FilterTab } from '@/components/public/FilterTabs';
import SeasonCard from './components/SeasonCard';

type Filter = 'all' | SeasonStatus;

export default function SeasonsScreen() {
	const { t } = useTranslation();
	const [filter, setFilter] = useState<Filter>('all');
	const [search, setSearch] = useState('');
	const [seasons, setSeasons] = useState<Season[]>([]);
	const [loading, setLoading] = useState(true);

	useDocumentTitle([t('public.seasons.title')]);

	useEffect(() => {
		seasonApi.getAll()
			.then((res) => setSeasons(res.data))
			.catch((error) => console.error(error))
			.finally(() => setLoading(false));
	}, []);

	const tabs: FilterTab<Filter>[] = [
		{ value: 'all', label: t('seasons.filter.all') },
		{ value: SeasonStatus.ACTIVE, label: t('seasons.status.ACTIVE'), dot: 'rgb(var(--success))' },
		{ value: SeasonStatus.COMPLETED, label: t('seasons.status.COMPLETED') },
		{ value: SeasonStatus.DRAFT, label: t('seasons.status.DRAFT') },
	];

	const visible = useMemo(() => {
		const term = search.trim().toLowerCase();
		return seasons.filter((season) => {
			if (filter !== 'all' && season.status !== filter) return false;
			if (!term) return true;
			return (
				season.name.toLowerCase().includes(term) ||
				(season.league?.name ?? '').toLowerCase().includes(term)
			);
		});
	}, [seasons, filter, search]);

	// The hero photograph follows whatever sport the listed seasons are in.
	const sport = seasons.find((season) => season.league?.sportType)?.league?.sportType as SportType | undefined;

	return (
		<>
			<PublicHero
				kicker={t('public.hero.kicker')}
				title={t('public.seasons.title')}
				subtitle={t('public.seasons.subtitle')}
				crumbs={[{ label: t('public.nav.home'), to: '/' }, { label: t('public.seasons.title') }]}
				sport={sport}
			/>

			<div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-7 sm:px-8">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<FilterTabs tabs={tabs} value={filter} onChange={setFilter} />
					<div className="flex h-10 items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 sm:ml-auto sm:w-64">
						<Search className="size-4 shrink-0 text-muted-foreground" />
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t('public.seasons.searchPlaceholder')}
							aria-label={t('public.seasons.searchPlaceholder')}
							className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						/>
					</div>
				</div>

				{loading ? (
					<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
						{[0, 1, 2].map((key) => (
							<div key={key} className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
						))}
					</div>
				) : visible.length === 0 ? (
					<EmptyState
						icon={<CalendarDays className="size-7" />}
						title={t('seasons.noSeasons')}
						hint={t('public.seasons.emptyHint')}
					/>
				) : (
					<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
						{visible.map((season) => (
							<SeasonCard key={season.id} season={season} />
						))}
					</div>
				)}
			</div>
		</>
	);
}
