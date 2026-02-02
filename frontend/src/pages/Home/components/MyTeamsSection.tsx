import React from "react";
import { useTranslation } from 'react-i18next';
import TeamCard from '@pages/TeamManager/components/TeamCard'

import type { Team } from '@types';

interface MyTeamsSectionProps {
  teams: Team[];
}

export default function MyTeamsSection({ teams }: MyTeamsSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (teams.length === 0) return null;

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-4">{t('home.myTeams')}</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
}
