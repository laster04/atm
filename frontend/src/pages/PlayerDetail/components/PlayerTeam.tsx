import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Player } from '@types';

interface PlayerTeamProps {
  player: Player;
}

export default function PlayerTeam({ player }: PlayerTeamProps) {
  const { t } = useTranslation();

  if (!player.team) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">{t('playerDetail.team.title')}</h2>

      <Link
        to={`/teams/${player.team.id}`}
        className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {player.team.logo ? (
            <img
              src={player.team.logo}
              alt={player.team.name}
              className="w-12 h-12 object-contain"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xl font-bold">
              {player.team.name.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-bold text-lg">{player.team.name}</p>
            {player.team.season && (
              <p className="text-sm text-gray-500">{player.team.season.name}</p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
