import type { TournamentGame, TournamentTeam } from '@types';
import { Td, Th, TableShell, HeadRow } from '@/components/public';
import { isPlayed } from './shared';

interface GroupMatrixProps {
	teams: TournamentTeam[];
	games: TournamentGame[];
	teamLabel: string;
}

/**
 * Every pairing of a group at once: a row's results read left to right, from
 * that team's side. Each pair plays once, so the reverse cell mirrors the same
 * game with the score turned round.
 */
export default function GroupMatrix({ teams, games, teamLabel }: GroupMatrixProps) {
	const cell = (rowId: string, colId: string): { score: string; won: boolean } | null => {
		const direct = games.find((game) => game.homeTeamId === rowId && game.awayTeamId === colId && isPlayed(game));
		if (direct) return { score: `${direct.homeScore}:${direct.awayScore}`, won: direct.homeScore! > direct.awayScore! };
		const reverse = games.find((game) => game.homeTeamId === colId && game.awayTeamId === rowId && isPlayed(game));
		if (reverse) return { score: `${reverse.awayScore}:${reverse.homeScore}`, won: reverse.awayScore! > reverse.homeScore! };
		return null;
	};

	return (
		<TableShell minWidth={Math.max(560, 200 + teams.length * 84)}>
			<thead>
				<HeadRow>
					<Th className="w-10 text-center">#</Th>
					<Th className="text-left">{teamLabel}</Th>
					{teams.map((team) => (
						<Th key={team.id} className="whitespace-nowrap text-center">
							{team.name}
						</Th>
					))}
				</HeadRow>
			</thead>
			<tbody>
				{teams.map((row, index) => (
					<tr key={row.id} className="border-t border-border-subtle">
						<Td className="text-center text-muted-foreground">{index + 1}</Td>
						<Td className="whitespace-nowrap text-left font-bold">{row.name}</Td>
						{teams.map((col) => {
							if (col.id === row.id) {
								return (
									<Td key={col.id} className="bg-muted text-center text-muted-foreground">
										—
									</Td>
								);
							}
							const result = cell(row.id, col.id);
							return (
								<Td
									key={col.id}
									className={`text-center tabular-nums ${
										result?.won ? 'font-semibold text-foreground' : 'text-muted-foreground'
									}`}
								>
									{result?.score ?? ''}
								</Td>
							);
						})}
					</tr>
				))}
			</tbody>
		</TableShell>
	);
}
