import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Users } from 'lucide-react';
import type { Team } from '@types';
import { EmptyState, TeamCrest } from '@/components/public';

export default function TeamsGrid({ teams }: { teams: Team[] }) {
	const { t } = useTranslation();

	if (!teams || teams.length === 0) {
		return <EmptyState title={t('seasonDetail.teams.noTeams')} />;
	}

	return (
		<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
			{teams.map((team) => (
				<Link
					key={team.id}
					to={`/teams/${team.id}`}
					className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 pl-6 shadow-sm transition-shadow hover:shadow-md"
				>
					<span
						aria-hidden
						className="absolute inset-y-0 left-0 w-1"
						style={{ backgroundColor: team.primaryColor || 'rgb(var(--navy))' }}
					/>
					<div className="flex items-center gap-3.5">
						<TeamCrest team={team} size={42} />
						<div className="flex min-w-0 flex-col gap-0.5">
							<h3 className="truncate text-lg font-bold leading-tight">{team.name}</h3>
							{team.manager && (
								<p className="truncate text-[13px] text-muted-foreground">
									{t('seasonDetail.teams.manager', { name: team.manager.name })}
								</p>
							)}
						</div>
					</div>
					<div className="flex items-center gap-2 border-t border-border-subtle pt-3.5 text-[13px] text-subtle-foreground">
						<Users className="size-4 text-muted-foreground" />
						{t('public.players.count', { count: team._count?.players ?? 0 })}
						<span className="ml-auto flex items-center gap-1.5 font-semibold text-primary">
							{t('public.teams.view')}
							<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
						</span>
					</div>
				</Link>
			))}
		</div>
	);
}
