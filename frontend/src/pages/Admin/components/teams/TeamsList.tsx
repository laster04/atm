import { useTranslation } from 'react-i18next';
import type { Season, Team } from '@types';

interface TeamsListProps {
  season: Season;
  teams: Team[];
  onAddTeam: () => void;
  onGenerateSchedule: () => void;
  onDeleteTeam: (id: number) => void;
}

export default function TeamsList({
  season,
  teams,
  onAddTeam,
  onGenerateSchedule,
  onDeleteTeam,
}: TeamsListProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">
          {t('admin.seasons.teamsIn', { name: season.name })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onAddTeam}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            {t('admin.teams.addTeam')}
          </button>
          <button
            onClick={onGenerateSchedule}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
            disabled={teams.length < 2}
          >
            {t('admin.teams.generateSchedule')}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {teams.map((team) => (
          <div
            key={team.id}
            className="p-3 bg-gray-50 rounded flex justify-between items-center"
          >
            <div>
              <div className="font-medium">{team.name}</div>
              <div className="text-sm text-gray-500">
                {team._count?.players} {t('common.players')}
                {team.manager && ` · ${t('admin.teams.managedBy', { name: team.manager.name })}`}
              </div>
            </div>
            <button
              onClick={() => onDeleteTeam(team.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              {t('common.delete')}
            </button>
          </div>
        ))}
        {teams.length === 0 && (
          <p className="text-gray-500 text-center py-4">{t('admin.teams.noTeams')}</p>
        )}
      </div>
    </div>
  );
}
