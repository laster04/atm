import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import type { Team } from '@types';

interface TeamCardProps {
	team: Team;
}

/** Two-letter monogram: initials of the first two words, else the first two letters. */
const monogram = (name: string) => {
	const words = name.trim().split(/\s+/).filter(Boolean);
	const letters = words.length > 1
		? words.slice(0, 2).map((w) => w[0]).join('')
		: name.slice(0, 2);
	return letters.toLocaleUpperCase();
};

export default function TeamCard({ team }: TeamCardProps) {
	const { t, i18n } = useTranslation();

	const color = team.primaryColor || '#003E7E';
	const next = team.nextGame;
	const isHome = next ? next.homeTeamId === team.id : false;
	const opponent = next
		? (isHome ? next.awayTeam?.name : next.homeTeam?.name) ?? t('teamManagement.pwa.unknownOpponent')
		: null;

	return (
		<Link
			to={`/team-management/${team.id}`}
			className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
		>
			<div
				className="flex items-center gap-3 p-3.5"
				style={{ borderLeft: `4px solid ${color}` }}
			>
				<span
					className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[15px] font-bold text-white"
					style={{ backgroundColor: color }}
				>
					{monogram(team.name)}
				</span>
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="truncate text-base font-semibold leading-tight">{team.name}</span>
					<span className="truncate text-xs text-muted-foreground">
						{[team.season?.name, t('teamManagement.pwa.playerCount', { count: team._count?.players ?? 0 })]
							.filter(Boolean)
							.join(' · ')}
					</span>
				</span>
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
			</div>

			<div className="flex items-center gap-2.5 border-t border-border bg-muted/30 px-3.5 py-2.5">
				<span className="tm-section-label shrink-0">{t('teamManagement.pwa.nextGame')}</span>
				{next ? (
					<>
						<span className="min-w-0 flex-1 truncate text-[13px]">
							{opponent} ({isHome ? t('teamManagement.pwa.home') : t('teamManagement.pwa.away')})
						</span>
						<span className="shrink-0 text-xs font-medium">
							{new Date(next.date!).toLocaleDateString(i18n.language, {
								weekday: 'short', day: 'numeric', month: 'short',
							})}
						</span>
					</>
				) : (
					<span className="flex-1 text-[13px] text-muted-foreground">
						{t('teamManagement.pwa.noScheduledGame')}
					</span>
				)}
			</div>
		</Link>
	);
}
