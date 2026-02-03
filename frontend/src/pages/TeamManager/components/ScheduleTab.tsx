import GamesList from '../../TeamDetail/components/GamesList';
import type { Game } from '@types';

interface ScheduleTabProps {
	games: Game[];
	teamId: number;
}

export default function ScheduleTab({ games, teamId }: ScheduleTabProps) {
	return (
		<div className="pb-20">
			<GamesList games={games} teamId={teamId} />
		</div>
	);
}
