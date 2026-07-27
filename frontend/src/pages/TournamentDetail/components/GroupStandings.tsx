import { useTranslation } from 'react-i18next';
import type { TournamentStanding, TournamentGroup } from '@types';

interface GroupStandingsProps {
  group: TournamentGroup;
  standings: TournamentStanding[];
}

export default function GroupStandings({ group, standings }: GroupStandingsProps) {
  const { t } = useTranslation();
  return (
    <div>
      <h3 className="font-semibold text-base mb-2">{t('tournamentDetail.groups.groupLabel', { name: group.name })}</h3>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2">{t('tournamentDetail.standings.rank')}</th>
              <th className="text-left px-3 py-2">{t('tournamentDetail.standings.team')}</th>
              <th className="text-center px-2 py-2">{t('tournamentDetail.standings.played')}</th>
              <th className="text-center px-2 py-2">{t('tournamentDetail.standings.won')}</th>
              <th className="text-center px-2 py-2">{t('tournamentDetail.standings.drawn')}</th>
              <th className="text-center px-2 py-2">{t('tournamentDetail.standings.lost')}</th>
              <th className="text-center px-2 py-2">{t('tournamentDetail.standings.goalsFor')}</th>
              <th className="text-center px-2 py-2">{t('tournamentDetail.standings.goalsAgainst')}</th>
              <th className="text-center px-2 py-2">{t('tournamentDetail.standings.goalDiff')}</th>
              <th className="text-center px-2 py-2 font-bold">{t('tournamentDetail.standings.points')}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.teamId} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    {s.team?.primaryColor && (
                      <div className="size-3 rounded-full" style={{ backgroundColor: s.team.primaryColor }} />
                    )}
                    {s.team?.name}
                    {s.team?.country && (
                      <span className="text-xs text-muted-foreground">({s.team.country})</span>
                    )}
                  </div>
                </td>
                <td className="text-center px-2 py-2">{s.played}</td>
                <td className="text-center px-2 py-2 text-green-600">{s.won}</td>
                <td className="text-center px-2 py-2 text-gray-500">{s.drawn}</td>
                <td className="text-center px-2 py-2 text-red-500">{s.lost}</td>
                <td className="text-center px-2 py-2">{s.goalsFor}</td>
                <td className="text-center px-2 py-2">{s.goalsAgainst}</td>
                <td className="text-center px-2 py-2">{s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}</td>
                <td className="text-center px-2 py-2 font-bold">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
