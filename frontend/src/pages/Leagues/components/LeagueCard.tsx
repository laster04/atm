import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarDays } from 'lucide-react';
import type { League } from '@types';

export default function LeagueCard({ league }: { league: League }) {
	const { t } = useTranslation();

	return (
		<Link
			to={`/leagues/${league.id}`}
			className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 pl-6 shadow-sm transition-shadow hover:shadow-md"
		>
			<span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />
			<span
				aria-hidden
				className="pointer-events-none absolute right-0 top-0 size-40 opacity-70"
				style={{ background: 'radial-gradient(120px 120px at 100% 0%, rgb(var(--accent)) 0%, rgb(var(--card) / 0) 70%)' }}
			/>

			<div className="relative flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3.5">
					{league.logo ? (
						<img src={league.logo} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
					) : (
						<span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-base font-extrabold text-accent-foreground">
							{league.name.charAt(0).toUpperCase()}
						</span>
					)}
					<h2 className="truncate text-xl font-bold leading-tight">{league.name}</h2>
				</div>
				<span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold tracking-wide text-accent-foreground">
					{t(`sports.${league.sportType}`)}
				</span>
			</div>

			{league.description && (
				<p className="relative line-clamp-2 text-[13px] leading-relaxed text-subtle-foreground">
					{league.description}
				</p>
			)}

			<div className="relative mt-auto flex items-center gap-2 border-t border-border-subtle pt-3.5 text-[13px] text-subtle-foreground">
				<CalendarDays className="size-4 text-muted-foreground" />
				{t('public.leagues.seasonCount', { count: league._count?.seasons ?? 0 })}
				<span className="ml-auto flex items-center gap-1.5 font-semibold text-primary">
					{t('public.leagues.view')}
					<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
				</span>
			</div>
		</Link>
	);
}
