import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarDays, Trophy, Users } from 'lucide-react';
import { formatSeasonDate } from '@/utils/date';
import { SeasonStatus, type Season } from '@types';
import { SeasonStatusBadge, VisibilityBadge } from '@/components/public';
import { strictest } from '@/utils/visibility';

/** The accent stripe reads status at a glance across a grid of cards. */
const STRIPE: Record<SeasonStatus, string> = {
	[SeasonStatus.ACTIVE]: 'rgb(var(--primary))',
	[SeasonStatus.COMPLETED]: 'rgb(var(--border))',
	[SeasonStatus.DRAFT]: 'rgb(var(--muted))',
};

export default function SeasonCard({ season }: { season: Season }) {
	const { t, i18n } = useTranslation();
	const teams = season._count?.seasonTeams ?? season._count?.teams ?? 0;
	const games = season._count?.games ?? 0;

	return (
		<Link
			to={`/season-detail/${season.id}`}
			className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 pl-6 shadow-sm transition-shadow hover:shadow-md"
		>
			<span
				aria-hidden
				className="absolute inset-y-0 left-0 w-1"
				style={{ backgroundColor: STRIPE[season.status] }}
			/>
			{/* A tint in the corner, not a photograph: the grid stays quiet. */}
			<span
				aria-hidden
				className="pointer-events-none absolute right-0 top-0 size-40 opacity-70"
				style={{ background: 'radial-gradient(120px 120px at 100% 0%, rgb(var(--accent)) 0%, rgb(var(--card) / 0) 70%)' }}
			/>

			<div className="relative flex items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h2 className="text-2xl font-extrabold leading-tight tracking-tight">{season.name}</h2>
					<p className="text-sm text-subtle-foreground">{season.league?.name || '—'}</p>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-1.5">
					<SeasonStatusBadge status={season.status} archived={!!season.archivedAt} />
					<VisibilityBadge visibility={strictest(season.league?.visibility, season.visibility)} />
				</div>
			</div>

			<div className="relative flex items-center gap-2 text-[13px] text-subtle-foreground">
				<CalendarDays className="size-4 text-muted-foreground" />
				{formatSeasonDate(season.startDate, i18n.language)} – {formatSeasonDate(season.endDate, i18n.language)}
			</div>

			<div className="relative flex items-center gap-5 border-t border-border-subtle pt-3.5 text-[13px] text-subtle-foreground">
				<span className="flex items-center gap-2">
					<Users className="size-4 text-muted-foreground" />
					{t('public.teams.count', { count: teams })}
				</span>
				<span className="flex items-center gap-2">
					<Trophy className="size-4 text-muted-foreground" />
					{t('public.games.count', { count: games })}
				</span>
				<span className="ml-auto flex items-center gap-1.5 text-[13px] font-semibold text-primary">
					{t('public.seasons.view')}
					<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
				</span>
			</div>
		</Link>
	);
}
