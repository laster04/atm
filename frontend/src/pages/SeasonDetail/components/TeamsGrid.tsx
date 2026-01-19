import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Team } from '@types';

interface TeamsGridProps {
  teams: Team[];
}

export default function TeamsGrid({ teams }: TeamsGridProps) {
  const { t } = useTranslation();

  if (!teams || teams.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
        {t('seasonDetail.teams.noTeams')}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teams.map((team) => (
        <Link
          key={team.id}
          to={`/teams/${team.id}`}
          className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-lg">{team.name}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {team._count?.players} {t('common.players')}
          </p>
          {team.manager && (
            <p className="text-sm text-gray-500">
              {t('seasonDetail.teams.manager', { name: team.manager.name })}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
