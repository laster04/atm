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
    <div className="teams-grid-container">
      {myTeams.length > 0 ? (
        <div className="teams-grid">
          {myTeams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          {t('myTeams.noTeams')}
        </div>
      )}
    </div>
  );
}
