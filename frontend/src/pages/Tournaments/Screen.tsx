import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Search, Trophy } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tournamentSeriesApi } from '@/services/api';
import type { TournamentSeries } from '@types';
import { EmptyState, PublicHero } from '@/components/public';

export default function TournamentsScreen() {
	const { t } = useTranslation();
	const [series, setSeries] = useState<TournamentSeries[]>([]);
	const [search, setSearch] = useState('');
	const [loading, setLoading] = useState(true);

	useDocumentTitle([t('public.tournaments.title')]);

	useEffect(() => {
		tournamentSeriesApi.getAll()
			.then((res) => setSeries(res.data))
			.catch((error) => console.error(error))
			.finally(() => setLoading(false));
	}, []);

	const visible = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return series;
		return series.filter((row) =>
			row.name.toLowerCase().includes(term) || (row.description ?? '').toLowerCase().includes(term)
		);
	}, [series, search]);

	return (
		<>
			<PublicHero
				kicker={t('public.hero.kicker')}
				title={t('public.tournaments.title')}
				subtitle={t('public.tournaments.subtitle')}
				crumbs={[{ label: t('public.nav.home'), to: '/' }, { label: t('public.nav.tournaments') }]}
				sport={series[0]?.sportType}
			/>

			<div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-7 sm:px-8">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="flex h-10 items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 sm:w-72">
						<Search className="size-4 shrink-0 text-muted-foreground" />
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t('public.tournaments.searchPlaceholder')}
							aria-label={t('public.tournaments.searchPlaceholder')}
							className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						/>
					</div>
					<span className="text-sm text-muted-foreground sm:ml-auto">
						{t('public.tournaments.count', { count: visible.length })}
					</span>
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
						title={t('public.tournaments.empty')}
						hint={t('public.tournaments.emptyHint')}
					/>
				) : (
					<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
						{visible.map((row) => (
							<Link
								key={row.id}
								to={`/tournaments/${row.id}`}
								className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 pl-6 shadow-sm transition-shadow hover:shadow-md"
							>
								<span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand" />
								<div className="flex items-start justify-between gap-3">
									<div className="flex min-w-0 items-center gap-3.5">
										{row.logo ? (
											<img src={row.logo} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
										) : (
											<span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/15">
												<Trophy className="size-5 text-brand-text" />
											</span>
										)}
										<h2 className="truncate text-xl font-bold leading-tight">{row.name}</h2>
									</div>
									<span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold tracking-wide text-accent-foreground">
										{t(`sports.${row.sportType}`)}
									</span>
								</div>

								{row.description && (
									<p className="line-clamp-2 text-[13px] leading-relaxed text-subtle-foreground">
										{row.description}
									</p>
								)}

								<div className="mt-auto flex items-center gap-2 border-t border-border-subtle pt-3.5 text-[13px] text-subtle-foreground">
									<Trophy className="size-4 text-muted-foreground" />
									{t('public.tournaments.editions', { count: row._count?.tournaments ?? 0 })}
									<span className="ml-auto flex items-center gap-1.5 font-semibold text-primary">
										{t('public.tournaments.view')}
										<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
									</span>
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</>
	);
}
