import { useTranslation } from 'react-i18next';
import type { TournamentTeam } from '@types';
import { Button } from '@components/base/button';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';

interface TennisTeamsPanelProps {
  teams: TournamentTeam[];
  openTeamCreate: () => void;
  openTeamEdit: (team: TournamentTeam) => void;
  deleteTeam: (teamId: number) => void;
}

export default function TennisTeamsPanel({ teams, openTeamCreate, openTeamEdit, deleteTeam }: TennisTeamsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openTeamCreate} size="sm" className="gap-1"><Plus className="size-4" /> {t('tm.tournament.teams.addButton_TENNIS')}</Button>
      </div>
      {teams.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border rounded-lg">{t('tm.tournament.teams.empty_TENNIS')}</div>
      ) : (
        <div className="divide-y border rounded-lg">
          {teams.map(team => (
            <div key={team.id} className="flex items-center gap-3 px-4 py-3">
              {team.primaryColor ? (
                <div className="size-8 rounded-full shrink-0" style={{ backgroundColor: team.primaryColor }} />
              ) : (
                <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Users className="size-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium">{team.name}</div>
                {team.country && <div className="text-xs text-muted-foreground">{team.country}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openTeamEdit(team)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => deleteTeam(team.id)} className="text-red-500 hover:text-red-700"><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
