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
      to={`/teams/${team.id}`}
      className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-blue-500"
    >
      <h2 className="font-semibold text-xl mb-2">{team.name}</h2>
      <p className="text-gray-600 mb-2">{team.season?.name}</p>
      <p className="text-sm text-gray-500">
        {team._count?.players} {t('common.players')}
      </p>
    </Link>
  );
}
