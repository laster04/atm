import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { teamApi } from '@/services/api';
import type { Team } from '@types';

import TeamCard from './components/TeamCard';

export default function Screen(): React.JSX.Element {
  const { t } = useTranslation();
  const { isTeamManager } = useAuth();
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isTeamManager()) {
      setLoading(true);
      teamApi.getMyTeams()
        .then((res) => setMyTeams(res.data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isTeamManager]);

  if (!isTeamManager()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">{t('myTeams.accessDenied')}</h1>
        <p className="text-gray-600 mt-2">{t('myTeams.noPrivileges')}</p>
      </div>
    );
  }

  if (loading && myTeams.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('common.loading')}</div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{t('myTeams.title')}</h1>

      {myTeams.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myTeams.map((team) => (
            <TeamCard key={team.id} team={team} />
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
