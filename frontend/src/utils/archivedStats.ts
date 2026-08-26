import type { ArchivedPlayerStat, TopScorer } from '@types';

export function mapArchivedPlayerStat(row: ArchivedPlayerStat): TopScorer {
	return {
		player: {
			id: row.player.id,
			name: row.player.name,
			number: row.player.number,
			teamId: row.player.team.id,
			team: { id: row.player.team.id, name: row.player.team.name }
		},
		goals: row.goals,
		assists: row.assists,
		gamesPlayed: row.gamesPlayed,
		points: row.points
	};
}
