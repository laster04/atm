import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { teamApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Team } from '../types';

export default function MyTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { isTeamManager } = useAuth();

  useEffect(() => {
    if (isTeamManager()) {
      teamApi.getMyTeams()
        .then(res => setTeams(res.data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (!isTeamManager()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">{t('myTeams.accessDenied')}</h1>
        <p className="text-gray-600 mt-2">{t('myTeams.noPrivileges')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{t('myTeams.title')}</h1>

      {teams.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => (
            <Link
              key={team.id}
              to={`/teams/${team.id}`}
              className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-blue-500"
            >
              <h2 className="font-semibold text-xl mb-2">{team.name}</h2>
              <p className="text-gray-600 mb-2">{team.season?.name}</p>
              <p className="text-sm text-gray-500">
                {team._count?.players} {t('common.players')}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {t('myTeams.noTeams')}
        </div>
      )}
    </div>
  );
}
