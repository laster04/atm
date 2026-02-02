import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { teamApi } from '@/services/api';
import type { Team } from '@types';

import TeamCard from './components/TeamCard';

export default function Screen(): React.JSX.Element {
  const { t } = useTranslation();
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    teamApi.getMyTeams()
      .then((res) => setMyTeams(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading && myTeams.length === 0) {
    return (
      <div className="text-center py-8">{t('common.loading')}</div>
    );
  }

  return (
    <div>
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
