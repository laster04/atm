import { useTranslation } from 'react-i18next';
import type { Player } from '@types';

interface PlayerInfoProps {
  player: Player;
}

export default function PlayerInfo({ player }: PlayerInfoProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">{t('playerDetail.info.title')}</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">{t('playerDetail.info.name')}</p>
          <p className="font-medium">{player.name}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">{t('playerDetail.info.number')}</p>
          <p className="font-medium">{player.number ?? '-'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">{t('playerDetail.info.position')}</p>
          <p className="font-medium">{player.position || '-'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">{t('playerDetail.info.bornYear')}</p>
          <p className="font-medium">{player.bornYear ?? '-'}</p>
        </div>
        {player.note && (
          <div className="col-span-2">
            <p className="text-sm text-gray-500">{t('playerDetail.info.note')}</p>
            <p className="font-medium">{player.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
