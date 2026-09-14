import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, MapPin, Trophy, Users } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tournamentSeriesApi } from '@/services/api';
import type { TournamentSeries, TournamentStatus } from '@types';
import { EmptyState, Panel, PublicHero, VisibilityBadge } from '@/components/public';

/** Same soft/strong badge tones the rest of the public part uses. */
const STATUS_TONE: Record<TournamentStatus, string> = {
	DRAFT: 'bg-muted text-subtle-foreground',
	REGISTRATION: 'bg-warning-soft text-warning-strong',
	GROUP_STAGE: 'bg-accent text-accent-foreground',
	PLAYOFF: 'bg-brand/20 text-brand-text',
	COMPLETED: 'bg-success-soft text-success-strong',
};

export default function TournamentSeriesDetail() {
	const { t } = useTranslation();
	const { id } = useParams<{ id: string }>();
	const [series, setSeries] = useState<TournamentSeries | null>(null);
	const [loading, setLoading] = useState(true);
	const tennisCtx = series?.sportType === 'TENNIS' ? 'TENNIS' : undefined;

	useDocumentTitle([series?.name]);

	useEffect(() => {
		if (!id) return;
		tournamentSeriesApi.getById(id)
			.then((res) => setSeries(res.data))
			.catch((error) => console.error(error))
			.finally(() => setLoading(false));
	}, [id]);

	if (loading) {
		return (
			<div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
				{t('common.loading')}
			</div>
		);
	}

	if (!series) {
		return (
			<div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
				{t('tournamentDetail.notFound')}
			</div>
		);
	}

	// Newest edition first — a series page opens on the current one.
	const editions = [...(series.tournaments ?? [])].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

	return (
		<>
			<PublicHero
				title={series.name}
				subtitle={series.description || undefined}
				sport={series.sportType}
				crumbs={[
					{ label: t('public.nav.home'), to: '/' },
					{ label: t('public.nav.tournaments'), to: '/tournaments' },
					{ label: series.name },
				]}
				badge={
					<>
						<span className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand">
							{t(`sports.${series.sportType}`)}
						</span>
						<VisibilityBadge visibility={series.visibility} />
					</>
				}
				meta={
					<span className="flex items-center gap-2">
						<Trophy className="size-4 text-brand" />
						{t('public.tournaments.editions', { count: editions.length })}
					</span>
				}
			/>

			<div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-7 sm:px-8">
				<Panel flush title={t('public.tournaments.editionsTitle')}>
					{editions.length === 0 ? (
						<EmptyState title={t('public.tournaments.noEditions')} />
					) : (
						<div className="flex flex-col">
							{editions.map((edition) => (
								<Link
									key={edition.id}
									to={`/tournament/${edition.id}`}
									className="flex items-center gap-4 border-b border-border-subtle px-5 py-4 transition-colors last:border-0 hover:bg-muted/50"
								>
									<div className="flex min-w-0 flex-col gap-1">
										<div className="flex flex-wrap items-center gap-2.5">
											<span className="truncate font-bold">{edition.name}</span>
											{edition.year && <span className="text-sm text-muted-foreground">{edition.year}</span>}
											<span
												className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
													STATUS_TONE[edition.status] ?? STATUS_TONE.DRAFT
												}`}
											>
												{t(`public.tournaments.status.${edition.status}`)}
											</span>
										</div>
										{edition.location && (
											<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
												<MapPin className="size-3.5" />
												{edition.location}
											</span>
										)}
									</div>
									<div className="ml-auto flex shrink-0 items-center gap-3 text-[13px] text-subtle-foreground">
										{edition._count && (
											<span className="flex items-center gap-1.5">
												<Users className="size-4 text-muted-foreground" />
												{t('tournamentDetail.teamsCount', { count: edition._count.teams, context: tennisCtx })}
											</span>
										)}
										<ChevronRight className="size-4 text-primary" />
									</div>
								</Link>
							))}
						</div>
					)}
				</Panel>
			</div>
		</>
	);
}
