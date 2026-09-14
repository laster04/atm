import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Team } from '@types';
import TeamCrest from './TeamCrest';
import type { Crumb } from './PublicHero';

interface TeamHeroBandProps {
	team: Pick<Team, 'name' | 'logo' | 'primaryColor'>;
	subtitle?: React.ReactNode;
	crumbs?: Crumb[];
	/** Three at most — rank, points, goal record. */
	figures?: { label: string; value: React.ReactNode }[];
	children?: React.ReactNode;
}

/**
 * A team's own colour carries its page, the way the manager shells do: no
 * photograph, just the colour, the crest and the numbers that matter.
 *
 * Team colours are user-chosen and can be pale, so the band keeps white ink and
 * darkens the colour underneath rather than trusting it to be dark enough.
 */
export default function TeamHeroBand({ team, subtitle, crumbs, figures, children }: TeamHeroBandProps) {
	const color = team.primaryColor || '#0F172A';

	return (
		<section className="relative overflow-hidden" style={{ backgroundColor: color }}>
			<div className="absolute inset-0 bg-navy/35" aria-hidden />
			<span
				aria-hidden
				className="absolute -right-20 -top-32 size-[420px] rounded-full bg-white/[0.07]"
			/>
			<div className="relative mx-auto flex max-w-[1600px] flex-col gap-5 px-4 pb-6 pt-7 sm:px-8">
				{crumbs && crumbs.length > 0 && (
					<nav className="flex flex-wrap items-center gap-1.5 text-xs text-white/60">
						{crumbs.map((crumb, index) => (
							<span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
								{crumb.to ? (
									<Link to={crumb.to} className="hover:text-white">{crumb.label}</Link>
								) : (
									<span className="text-white/90">{crumb.label}</span>
								)}
								{index < crumbs.length - 1 && <ChevronRight className="size-3" />}
							</span>
						))}
					</nav>
				)}

				<div className="flex flex-col gap-5 sm:flex-row sm:items-center">
					<div className="flex min-w-0 items-center gap-4 sm:gap-6">
						<span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg sm:size-20">
							<TeamCrest team={team} size={56} className="!bg-transparent !text-current" />
						</span>
						<div className="flex min-w-0 flex-col gap-1.5">
							<h1 className="truncate text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-[38px]">
								{team.name}
							</h1>
							{subtitle && <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">{subtitle}</div>}
						</div>
					</div>

					{figures && figures.length > 0 && (
						<div className="flex gap-3 sm:ml-auto">
							{figures.map((figure) => (
								<div
									key={figure.label}
									className="flex min-w-20 flex-col items-center gap-0.5 rounded-xl bg-white/15 px-4 py-3"
								>
									<span className="text-xl font-extrabold leading-tight text-white sm:text-2xl">{figure.value}</span>
									<span className="text-[10px] font-semibold uppercase tracking-wider text-white/75">
										{figure.label}
									</span>
								</div>
							))}
						</div>
					)}
				</div>

				{children}
			</div>
		</section>
	);
}
