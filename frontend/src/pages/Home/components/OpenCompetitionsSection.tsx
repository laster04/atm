import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Panel } from '@/components/public';
import ApplicationsOpenBadge from '@/components/registrations/ApplicationsOpenBadge';
import { REGISTRATION_SLUG } from '@/components/registrations/SharePanel';
import type { Season, TournamentSeries } from '@types';

const OPEN_LIMIT = 6;
const PLAYING_LIMIT = 4;

interface OpenCompetitionsSectionProps {
	seasons: Season[];
	series: TournamentSeries[];
	loading: boolean;
}

/**
 * Where a team can still get in: the seasons and tournament series taking
 * applications right now, then the seasons being played, which used to be
 * the whole dashboard.
 */
export default function OpenCompetitionsSection({ seasons, series, loading }: OpenCompetitionsSectionProps) {
	const { t } = useTranslation();

	const open = [
		...seasons.filter((season) => season.registrationOpen).map((season) => ({
			key: `season-${season.id}`,
			to: `/prihlaska/${REGISTRATION_SLUG.season}/${season.id}`,
			name: season.league?.name ?? season.name,
			detail: season.league ? season.name : null,
			kind: t('dashboard.managed.kind.season'),
		})),
		...series.filter((row) => row.registrationOpen).map((row) => ({
			key: `series-${row.id}`,
			to: `/tournaments/${row.id}`,
			name: row.name,
			detail: null,
			kind: t('dashboard.managed.kind.tournament'),
		})),
	].slice(0, OPEN_LIMIT);
	const playing = seasons.filter((season) => season.status === 'ACTIVE').slice(0, PLAYING_LIMIT);

	return (
		<div className="flex flex-col gap-4" data-tour="open-competitions">
			<Panel
				title={t('dashboard.open.title')}
				description={t('dashboard.open.text')}
				action={
					<Link to="/seasons" className="text-[13px] font-semibold text-primary hover:underline">
						{t('dashboard.open.all')}
					</Link>
				}
				flush
			>
				{loading ? (
					<p className="px-5 py-4 text-[14px] text-muted-foreground">{t('common.loading')}</p>
				) : open.length === 0 ? (
					<p className="px-5 py-4 text-[14px] text-muted-foreground">{t('dashboard.open.empty')}</p>
				) : (
					<ul className="divide-y divide-border">
						{open.map((row) => (
							<li key={row.key}>
								<Link to={row.to} className="flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-muted/60">
									<span className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
										<span className="truncate text-[15px] font-semibold">{row.name}</span>
										<span className="truncate text-[12.5px] text-muted-foreground">
											{[row.kind, row.detail].filter(Boolean).join(' · ')}
										</span>
									</span>
									<ApplicationsOpenBadge />
									<ChevronRight className="size-4 text-muted-foreground" aria-hidden />
								</Link>
							</li>
						))}
					</ul>
				)}
			</Panel>

			{playing.length > 0 && (
				<Panel
					title={t('dashboard.playing.title')}
					action={
						<Link to="/seasons" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
							{t('home.viewAllSeasons')}
							<ArrowRight className="size-3.5" aria-hidden />
						</Link>
					}
					flush
				>
					<ul className="divide-y divide-border">
						{playing.map((season) => (
							<li key={season.id}>
								<Link to={`/season-detail/${season.id}`} className="flex min-h-[60px] flex-col justify-center gap-0.5 px-5 py-3 hover:bg-muted/60">
									<span className="truncate text-[15px] font-semibold">{season.league?.name ?? season.name}</span>
									<span className="truncate text-[12.5px] text-muted-foreground">
										{[
											season.league && season.name,
											t('dashboard.playing.teams', { count: season._count?.seasonTeams ?? season._count?.teams ?? 0 }),
											t('dashboard.playing.games', { count: season._count?.games ?? 0 }),
										].filter(Boolean).join(' · ')}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</Panel>
			)}
		</div>
	);
}
