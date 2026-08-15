import { useTranslation } from 'react-i18next';
import type { TournamentTeam, TournamentPlayer } from '@types';
import { Button } from '@components/base/button';
import { Plus, Pencil, Trash2, Users, ChevronDown, ChevronRight } from 'lucide-react';

interface TeamsPanelProps {
  teams: TournamentTeam[];
  expandedTeam: number | null;
  teamPlayers: Record<number, TournamentPlayer[]>;
  toggleTeam: (teamId: number) => void;
  openTeamCreate: () => void;
  openTeamEdit: (team: TournamentTeam) => void;
  deleteTeam: (teamId: number) => void;
  openPlayerCreate: (teamId: number) => void;
  openPlayerEdit: (player: TournamentPlayer) => void;
  deletePlayer: (playerId: number, teamId: number) => void;
}

export default function TeamsPanel({
  teams, expandedTeam, teamPlayers, toggleTeam,
  openTeamCreate, openTeamEdit, deleteTeam,
  openPlayerCreate, openPlayerEdit, deletePlayer,
}: TeamsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openTeamCreate} size="sm" className="gap-1"><Plus className="size-4" /> {t('tm.tournament.teams.addButton')}</Button>
      </div>
      {teams.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border rounded-lg">{t('tm.tournament.teams.empty')}</div>
      ) : (
        <div className="divide-y border rounded-lg">
          {teams.map(team => (
            <div key={team.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                {team.primaryColor ? (
                  <div className="size-8 rounded-full shrink-0" style={{ backgroundColor: team.primaryColor }} />
                ) : (
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Users className="size-4 text-muted-foreground" />
                  </div>
                )}
                <button className="flex-1 text-left min-w-0" onClick={() => toggleTeam(team.id)}>
                  <div className="font-medium">{team.name}</div>
                  {team.country && <div className="text-xs text-muted-foreground">{team.country}</div>}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openPlayerCreate(team.id)} title={t('tm.tournament.teams.addPlayerTitle')}><Plus className="size-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => openTeamEdit(team)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteTeam(team.id)} className="text-red-500 hover:text-red-700"><Trash2 className="size-4" /></Button>
                  <button onClick={() => toggleTeam(team.id)} className="p-1 text-muted-foreground">
                    {expandedTeam === team.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                </div>
              </div>
              {expandedTeam === team.id && (
                <div className="bg-muted/30 px-6 pb-3">
                  {(teamPlayers[team.id] ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">{t('tm.tournament.teams.noPlayers')}</p>
                  ) : (
                    <table className="w-full text-sm mt-2">
                      <thead><tr className="text-muted-foreground text-xs"><th className="text-left py-1 w-8">{t('tm.tournament.teams.table.number')}</th><th className="text-left py-1">{t('tm.tournament.teams.table.name')}</th><th className="text-left py-1">{t('tm.tournament.teams.table.position')}</th><th className="text-left py-1">{t('tm.tournament.teams.table.born')}</th><th /></tr></thead>
                      <tbody>
                        {(teamPlayers[team.id] ?? []).map(p => (
                          <tr key={p.id} className="border-t border-muted">
                            <td className="py-1.5 text-muted-foreground">{p.number ?? '-'}</td>
                            <td className="py-1.5 font-medium">{p.name}</td>
                            <td className="py-1.5 text-muted-foreground">{p.position ?? '-'}</td>
                            <td className="py-1.5 text-muted-foreground">{p.bornYear ?? '-'}</td>
                            <td className="py-1.5 text-right">
                              <Button variant="ghost" size="sm" onClick={() => openPlayerEdit(p)}><Pencil className="size-3" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => deletePlayer(p.id, team.id)} className="text-red-500"><Trash2 className="size-3" /></Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
