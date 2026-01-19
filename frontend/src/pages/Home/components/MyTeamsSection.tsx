import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Team } from '@types';

interface MyTeamsSectionProps {
  teams: Team[];
}

export default function MyTeamsSection({ teams }: MyTeamsSectionProps) {
  const { t } = useTranslation();

  if (teams.length === 0) return null;

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-4">{t('home.myTeams')}</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {teams.map((team) => (
          <Link
            key={team.id}
            to={`/teams/${team.id}`}
            className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-blue-500"
          >
            <h3 className="font-semibold text-lg">{team.name}</h3>
            <p className="text-gray-600">{team.season?.name}</p>
            <p className="text-sm text-gray-500 mt-2">
              {team._count?.players} {t('common.players')}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
