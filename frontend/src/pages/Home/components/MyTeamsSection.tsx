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
    <section>
      <h2 className="mb-3 text-[20px] font-bold">{t('home.myTeams')}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </section>
  );
}
