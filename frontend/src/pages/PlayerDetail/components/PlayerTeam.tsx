import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import type { Player } from '@types';
import { Panel, TeamCrest } from '@/components/public';

export default function PlayerTeam({ player }: { player: Player }) {
	const { t } = useTranslation();

	if (!player.team) return null;

	return (
		<Panel title={t('playerDetail.team.title')}>
			<Link
				to={`/teams/${player.team.id}`}
				className="group flex items-center gap-3.5 rounded-xl border border-border p-4 transition-colors hover:bg-muted/50"
			>
				<TeamCrest team={player.team} size={44} />
				<div className="flex min-w-0 flex-col">
					<span className="truncate font-bold">{player.team.name}</span>
					{player.team.season && (
						<span className="truncate text-[13px] text-muted-foreground">{player.team.season.name}</span>
					)}
				</div>
				<ArrowRight className="ml-auto size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
			</Link>
		</Panel>
	);
}
