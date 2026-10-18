import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink, MessageCircle } from 'lucide-react';
import { playerApi } from '@/services/api';
import TeamCrest from '@/components/public/TeamCrest';
import type { MyPlayerProfile } from '@types';

/** The season a team card names: the running one, else the most recent. */
const currentSeason = (team: MyPlayerProfile['team']) =>
	[...(team.seasons ?? [])]
		.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
		.find((season) => season.status === 'ACTIVE') ?? team.seasons?.[0];

/**
 * Every team the signed-in person holds a roster spot on - where a player who
 * just accepted an invite finds their team, and the way into its group chat.
 * Renders nothing for an account that plays for no one.
 */
export default function MyPlayerTeamsSection() {
	const { t } = useTranslation();
	const [profiles, setProfiles] = useState<MyPlayerProfile[]>([]);

	useEffect(() => {
		playerApi
			.getMine()
			.then((res) => setProfiles(res.data))
			.catch(() => setProfiles([]));
	}, []);

	if (profiles.length === 0) return null;

	return (
		<section>
			<h2 className="mb-3 text-[20px] font-bold">{t('home.myPlayerTeams.title')}</h2>
			<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
				{profiles.map((profile) => {
					const { team } = profile;
					const season = currentSeason(team);
					return (
						<div
							key={profile.id}
							className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5"
						>
							<Link to={`/teams/${team.id}`} className="flex min-h-11 items-center gap-3">
								<TeamCrest team={team} size={40} />
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate text-[15px] font-semibold">{team.name}</span>
									<span className="truncate text-[12px] text-muted-foreground">
										{[
											profile.number != null && t('home.myPlayerTeams.number', { number: profile.number }),
											season?.name,
										].filter(Boolean).join(' · ') || t('home.myPlayerTeams.teamPage')}
									</span>
								</span>
								<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
							</Link>

							{team.chatUrl ? (
								<a
									href={team.chatUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[14.5px] font-semibold text-white"
									style={{ backgroundColor: team.primaryColor || '#0F172A' }}
								>
									<MessageCircle className="size-4" aria-hidden />
									{t('home.myPlayerTeams.openChat')}
									<ExternalLink className="size-3.5 opacity-80" aria-hidden />
								</a>
							) : (
								<p className="text-[12.5px] text-muted-foreground">{t('home.myPlayerTeams.noChat')}</p>
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
}
