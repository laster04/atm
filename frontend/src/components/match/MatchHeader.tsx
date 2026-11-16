import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Share2 } from 'lucide-react';
import { TeamCrest } from '@/components/public';
import { formatGameDateTime } from '@/utils/date';
import type { PartScore, Team } from '@types';

type CrestTeam = Pick<Team, 'id' | 'name' | 'logo' | 'primaryColor'>;

export interface MatchSide {
	team: CrestTeam;
	/** Where the team's name leads; none on a page that should keep visitors in place. */
	href?: string | null;
	/** A line under the name: the place in the table. */
	note?: string | null;
}

interface MatchHeaderProps {
	crumbs: { label: string; to?: string }[];
	home: MatchSide;
	away: MatchSide;
	homeScore: number | null;
	awayScore: number | null;
	/** Played or being played; a game still to come shows "vs". */
	scored: boolean;
	/** Each period's score under the main one; volleyball sets have their own panel instead. */
	parts?: PartScore[] | null;
	status: { label: string; className: string };
	date: string | null;
	location: string | null;
}

/**
 * The navy band at the top of a match page, league or tournament: both teams,
 * the score, the status, when and where, and a share button.
 */
export default function MatchHeader({ crumbs, home, away, homeScore, awayScore, scored, parts, status, date, location }: MatchHeaderProps) {
	const { t, i18n } = useTranslation();
	const [copied, setCopied] = useState(false);
	const when = formatGameDateTime(date, i18n.language);

	// The phone's own share sheet where there is one, else the link on the clipboard.
	const share = async () => {
		const url = window.location.href;
		const title = `${home.team.name} ${scored ? `${homeScore}:${awayScore}` : '–'} ${away.team.name}`;
		try {
			if (navigator.share) {
				await navigator.share({ title, url });
				return;
			}
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// The share sheet was closed; nothing to do.
		}
	};

	const side = ({ team, href, note }: MatchSide) => {
		const content = (
			<>
				{/* A logo sits on a white tile whatever its own colours. Without one, or when
				    it fails to load, the crest falls back to initials on the team colour,
				    so it must keep its own background. */}
				<span className="flex size-16 items-center justify-center rounded-2xl bg-white shadow-lg sm:size-20">
					<TeamCrest team={team} size={48} />
				</span>
				<span className="text-[15px] font-bold leading-tight sm:text-2xl sm:font-extrabold">{team.name}</span>
				{note && <span className="text-xs text-white/70 sm:text-[13px]">{note}</span>}
			</>
		);
		const className = 'flex min-w-0 flex-col items-center gap-2.5 text-center text-white';
		return href ? <Link to={href} className={`${className} hover:opacity-90`}>{content}</Link> : <div className={className}>{content}</div>;
	};

	return (
		<section className="bg-navy text-white">
			<div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 pb-7 pt-5 sm:px-8 sm:pb-9">
				<div className="flex items-center justify-between gap-3">
					<nav aria-label={t('gameDetail.breadcrumb')} className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-white/70">
						{crumbs.map((crumb, index) => (
							<span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
								{index > 0 && <ChevronRight className="size-3" aria-hidden />}
								{crumb.to ? <Link to={crumb.to} className="hover:text-white">{crumb.label}</Link> : <span className="text-white/90">{crumb.label}</span>}
							</span>
						))}
					</nav>
					<button
						type="button"
						onClick={share}
						className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 text-sm font-semibold hover:bg-white/15"
					>
						{copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
						<span className="hidden sm:inline">{copied ? t('gameDetail.copied') : t('gameDetail.share')}</span>
						<span className="sr-only sm:hidden">{copied ? t('gameDetail.copied') : t('gameDetail.share')}</span>
					</button>
				</div>

				<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
					{side(home)}
					<div className="flex flex-col items-center gap-2.5">
						<span className="text-5xl font-extrabold leading-none tabular-nums tracking-tight sm:text-7xl">
							{scored ? `${homeScore} : ${awayScore}` : t('gameDetail.vs')}
						</span>
						{scored && parts && parts.length > 0 && (
							<span className="flex flex-wrap justify-center gap-1.5 text-xs tabular-nums">
								{parts.map((part, index) => (
									<span key={index} className="rounded-md bg-white/10 px-2 py-1">{part.home}:{part.away}</span>
								))}
							</span>
						)}
						<span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
					</div>
					{side(away)}
				</div>

				{(when || location) && (
					<p className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-center text-sm text-white/75">
						{when && <span>{when}</span>}
						{location && <span>{location}</span>}
					</p>
				)}
			</div>
		</section>
	);
}
