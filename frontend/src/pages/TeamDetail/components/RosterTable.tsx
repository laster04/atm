import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Player } from '@types';

interface RosterTableProps {
  players: Player[];
  canManage: boolean;
  onAddPlayer: () => void;
  onEditPlayer: (player: Player) => void;
  onDeletePlayer: (playerId: number) => void;
}

export default function RosterTable({
  players,
  canManage,
  onAddPlayer,
  onEditPlayer,
  onDeletePlayer,
}: RosterTableProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          {t('teamDetail.roster', { count: players.length })}
        </h2>
        {canManage && (
          <button
            onClick={onAddPlayer}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            {t('teamDetail.addPlayer')}
          </button>
        )}
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {players.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t('teamDetail.noPlayers')}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                  {t('teamDetail.playerTable.number')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                  {t('teamDetail.playerTable.name')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                  {t('teamDetail.playerTable.position')}
                </th>
                {canManage && (
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                    {t('teamDetail.playerTable.actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{player.number || '-'}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/players/${player.id}`} className="hover:text-blue-600">
                      {player.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{player.position || '-'}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => onEditPlayer(player)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => onDeletePlayer(player.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
