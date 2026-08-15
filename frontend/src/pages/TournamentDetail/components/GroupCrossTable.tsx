import { useTranslation } from 'react-i18next';
import type { TournamentStanding, TournamentGroup, TournamentGame } from '@types';

interface GroupCrossTableProps {
  group: TournamentGroup;
  games: TournamentGame[];
  standings: TournamentStanding[];
}

export default function GroupCrossTable({ group, games, standings }: GroupCrossTableProps) {
  const { t } = useTranslation();
  const teams = (group.teams ?? []).map(gt => gt.team);

  const rankByTeamId = new Map(standings.map((s, i) => [s.teamId, i + 1]));
  const standingByTeamId = new Map(standings.map(s => [s.teamId, s]));

  // Each pair is only ever played once (fixed home/away), so mirror the
  // result into the reverse cell with scores swapped to the row team's side.
  const cell = (rowId: number, colId: number): string => {
    const direct = games.find(g => g.homeTeamId === rowId && g.awayTeamId === colId);
    if (direct && direct.status === 'COMPLETED') return `${direct.homeScore}:${direct.awayScore}`;
    const reverse = games.find(g => g.homeTeamId === colId && g.awayTeamId === rowId);
    if (reverse && reverse.status === 'COMPLETED') return `${reverse.awayScore}:${reverse.homeScore}`;
    return '';
  };

  return (
    <div>
      <h3 className="font-semibold text-base mb-2">{t('tournamentDetail.groups.groupLabel', { name: group.name })}</h3>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="border p-2 w-32" />
              {teams.map(team => (
                <th key={team.id} className="border px-2 py-2 text-xs font-semibold uppercase whitespace-nowrap">{team.name}</th>
              ))}
              <th className="border px-2 py-2 bg-gray-300 dark:bg-gray-600 text-xs font-semibold">{t('tournamentDetail.crossTable.score')}</th>
              <th className="border px-2 py-2 bg-gray-300 dark:bg-gray-600 text-xs font-semibold">{t('tournamentDetail.crossTable.points')}</th>
              <th className="border px-2 py-2 bg-gray-300 dark:bg-gray-600 text-xs font-semibold">{t('tournamentDetail.crossTable.rank')}</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(rowTeam => {
              const standing = standingByTeamId.get(rowTeam.id);
              return (
                <tr key={rowTeam.id}>
                  <th className="border px-2 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap">{rowTeam.name}</th>
                  {teams.map(colTeam => (
                    <td
                      key={colTeam.id}
                      className={`border px-2 py-2 text-center ${colTeam.id === rowTeam.id ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                    >
                      {colTeam.id === rowTeam.id ? '' : cell(rowTeam.id, colTeam.id)}
                    </td>
                  ))}
                  <td className="border px-2 py-2 bg-gray-200 dark:bg-gray-700 text-center">
                    {standing ? `${standing.goalsFor}:${standing.goalsAgainst}` : ''}
                  </td>
                  <td className="border px-2 py-2 bg-gray-200 dark:bg-gray-700 text-center font-semibold">{standing?.points ?? ''}</td>
                  <td className="border px-2 py-2 bg-gray-200 dark:bg-gray-700 text-center">{rankByTeamId.get(rowTeam.id) ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
