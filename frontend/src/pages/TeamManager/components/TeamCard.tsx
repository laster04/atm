import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Team } from '@types';

interface TeamCardProps {
  team: Team;
}

export default function TeamCard({ team }: TeamCardProps) {
  const { t } = useTranslation();

  return (
    <Link
      to={`/team-management/${team.id}`}
      className="team-card"
      style={{
        backgroundColor: `${team.primaryColor}08`,
        borderLeftColor: team.primaryColor
      }}
    >
      <h2 className="team-card-title">{team.name}</h2>
      <p className="team-card-season">{team.season?.name}</p>
      <p className="team-card-count">
        {team._count?.players} {t('common.players')}
      </p>
    </Link>
  );
}
