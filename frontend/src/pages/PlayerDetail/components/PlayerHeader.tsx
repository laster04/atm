import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Player } from '@types';

interface PlayerHeaderProps {
  player: Player;
}

export default function PlayerHeader({ player }: PlayerHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-6">
        <Link to={`/teams/${player.team?.id}`} className="text-blue-600 hover:underline">
          ← {t('playerDetail.backTo', { name: player.team?.name })}
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex items-center gap-4">
          {player.number && (
            <div className="text-4xl font-bold text-gray-300">#{player.number}</div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{player.name}</h1>
            {player.position && (
              <p className="text-gray-600">{player.position}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
