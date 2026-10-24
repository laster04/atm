import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Share2 } from 'lucide-react';
import { TeamCrest } from '@/components/public';
import { formatGameDateTime } from '@/utils/date';
import type { SportProfile } from '@/utils/sportProfiles';
import type { GameDetail } from '@types';

/** The status chip: live, played, waiting for confirmation, or what else the game is. */
const statusChip = (game: GameDetail['game']): { key: string; className: string } => {
	if (game.status === 'IN_PROGRESS') return { key: 'live', className: 'bg-destructive-strong text-white' };
	if (game.status === 'COMPLETED') {
		return game.confirmed
			? { key: 'played', className: 'bg-success-soft text-success-strong' }
			: { key: 'waiting', className: 'bg-warning-soft text-warning-strong' };
	}
	return { key: game.status.toLowerCase(), className: 'bg-white/10 text-white' };
};

/** Navy band with both teams, the score and the score of each period or set. */
export default function MatchHeader({ detail, profile }: { detail: GameDetail; profile: SportProfile }) {
	const { t, i18n } = useTranslation();
	const { game, league, season } = detail;
	const [copied, setCopied] = useState(false);
	const scored = game.homeScore != null && game.awayScore != null && game.status !== 'SCHEDULED';
	const chip = statusChip(game);
	const rankOf = (teamId: string) => detail.table.rows.find((row) => row.team.id === teamId)?.rank;
	const when = formatGameDateTime(game.date, i18n.language);

	// The phone's own share sheet where there is one, else the link on the clipboard.
	const share = async () => {
		const url = window.location.href;
		const title = `${game.homeTeam.name} ${scored ? `${game.homeScore}:${game.awayScore}` : '–'} ${game.awayTeam.name}`;
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

	const side = (team: GameDetail['game']['homeTeam']) => {
		const rank = rankOf(team.id);
		return (
			<Link to={`/teams/${team.id}`} className="flex min-w-0 flex-col items-center gap-2.5 text-center text-white hover:opacity-90">
				<span className="flex size-14 items-center justify-center rounded-2xl bg-white shadow-lg sm:size-20">
					<TeamCrest team={team} size={48} className="!bg-transparent" />
				</span>
				<span className="text-[15px] font-bold leading-tight sm:text-2xl sm:font-extrabold">{team.name}</span>
				{rank && <span className="text-xs text-white/70 sm:text-[13px]">{t('gameDetail.rank', { rank })}</span>}
			</Link>
		);
	};

	return (
		<section className="bg-navy text-white">
			<div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 pb-7 pt-5 sm:px-8 sm:pb-9">
				<div className="flex items-center justify-between gap-3">
					<nav aria-label={t('gameDetail.breadcrumb')} className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-white/70">
						<Link to={`/leagues/${league.id}`} className="hover:text-white">{league.name}</Link>
						<ChevronRight className="size-3" aria-hidden />
						<Link to={`/season-detail/${season.id}`} className="hover:text-white">{season.name}</Link>
						{(game.round != null || game.playoff) && (
							<>
								<ChevronRight className="size-3" aria-hidden />
								<span className="text-white/90">
									{game.playoff ? t('gameDetail.playoff') : t('gameDetail.round', { n: game.round })}
								</span>
							</>
						)}
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
					{side(game.homeTeam)}
					<div className="flex flex-col items-center gap-2.5">
						<span className="text-5xl font-extrabold leading-none tabular-nums tracking-tight sm:text-7xl">
							{scored ? `${game.homeScore} : ${game.awayScore}` : t('gameDetail.vs')}
						</span>
						{scored && game.periodScores && game.periodScores.length > 0 && !profile.scoreIsPartsWon && (
							<span className="flex flex-wrap justify-center gap-1.5 text-xs tabular-nums">
								{game.periodScores.map((part, index) => (
									<span key={index} className="rounded-md bg-white/10 px-2 py-1">{part.home}:{part.away}</span>
								))}
							</span>
						)}
						<span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${chip.className}`}>
							{t(`gameDetail.status.${chip.key}`)}
						</span>
					</div>
					{side(game.awayTeam)}
				</div>

				{(when || game.location) && (
					<p className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-center text-sm text-white/75">
						{when && <span>{when}</span>}
						{game.location && <span>{game.location}</span>}
					</p>
				)}
			</div>
		</section>
	);
}
