import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Player } from '@types';
import TeamCrest from './TeamCrest';
import type { Crumb } from './PublicHero';

interface PlayerHeroBandProps {
	player: Player;
	crumbs?: Crumb[];
}

/**
 * The player band: navy, with the shirt number set large and ghosted behind the
 * name — the number is how a player is known on the ice, so it carries the page
 * without competing with the name for contrast.
 */
export default function PlayerHeroBand({ player, crumbs }: PlayerHeroBandProps) {
	const color = player.team?.primaryColor || '#0F172A';

	return (
		<section className="relative overflow-hidden bg-navy">
			{player.number != null && (
				<span
					aria-hidden
					className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 select-none text-[9rem] font-extrabold leading-none tracking-tighter text-white/[0.06] sm:block"
				>
					{player.number}
				</span>
			)}
			<div className="relative mx-auto flex max-w-[1600px] flex-col gap-5 px-4 pb-7 pt-7 sm:px-8">
				{crumbs && crumbs.length > 0 && (
					<nav className="flex flex-wrap items-center gap-1.5 text-xs text-white/55">
						{crumbs.map((crumb, index) => (
							<span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
								{crumb.to ? (
									<Link to={crumb.to} className="hover:text-white">{crumb.label}</Link>
								) : (
									<span className="text-white/85">{crumb.label}</span>
								)}
								{index < crumbs.length - 1 && <ChevronRight className="size-3" />}
							</span>
						))}
					</nav>
				)}

				<div className="flex items-center gap-4 sm:gap-6">
					<span
						className="flex size-16 shrink-0 items-center justify-center rounded-full border-[3px] border-white/25 text-xl font-extrabold text-white sm:size-[72px] sm:text-2xl"
						style={{ backgroundColor: color }}
					>
						{player.number ?? '—'}
					</span>
					<div className="flex min-w-0 flex-col gap-2">
						<h1 className="truncate text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-[36px]">
							{player.name}
						</h1>
						<div className="flex flex-wrap items-center gap-2.5">
							{player.team && (
								<Link
									to={`/teams/${player.team.id}`}
									className="flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-white/20"
								>
									<TeamCrest team={player.team} size={18} />
									{player.team.name}
								</Link>
							)}
							{player.position && (
								<span className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand">
									{player.position}
								</span>
							)}
							{player.team?.season && (
								<span className="text-[13px] text-white/70">
									{player.team.season.league?.name ? `${player.team.season.league.name} · ` : ''}
									{player.team.season.name}
								</span>
							)}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
