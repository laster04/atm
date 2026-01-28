import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatGameDateTime } from '@/utils/date';
import type { GameStatistic } from '@types';

interface PlayerStatisticsProps {
  statistics: GameStatistic[];
  totalGoals: number;
  totalAssists: number;
  gamesPlayed: number;
}

export default function PlayerStatistics({
  statistics,
  totalGoals,
  totalAssists,
  gamesPlayed
}: PlayerStatisticsProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">{t('playerDetail.statistics.title')}</h2>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">{gamesPlayed}</p>
          <p className="text-sm text-gray-500">{t('playerDetail.statistics.gamesPlayed')}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">{totalGoals}</p>
          <p className="text-sm text-gray-500">{t('playerDetail.statistics.goals')}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-purple-600">{totalAssists}</p>
          <p className="text-sm text-gray-500">{t('playerDetail.statistics.assists')}</p>
        </div>
      </div>

      {/* Game by game stats */}
      {statistics.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-2">
            {t('playerDetail.statistics.gameByGame')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">{t('playerDetail.statistics.date')}</th>
                  <th className="text-left py-2">{t('playerDetail.statistics.game')}</th>
                  <th className="text-center py-2">{t('playerDetail.statistics.goals')}</th>
                  <th className="text-center py-2">{t('playerDetail.statistics.assists')}</th>
                </tr>
              </thead>
              <tbody>
                {statistics.map((stat) => (
                  <tr key={stat.id} className="border-b last:border-0">
                    <td className="py-2 text-gray-500">
                      {stat.game?.date ? formatGameDateTime(stat.game.date, i18n.language) : '-'}
                    </td>
                    <td className="py-2">
                      <Link
                        to={`/game-statistic/${stat.game?.id}`}
                        className="hover:text-blue-600"
                      >
                        {stat.game?.homeTeam?.name} vs {stat.game?.awayTeam?.name}
                      </Link>
                    </td>
                    <td className="py-2 text-center font-medium">{stat.goals ?? 0}</td>
                    <td className="py-2 text-center font-medium">{stat.assists ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">
          {t('playerDetail.statistics.noStatistics')}
        </p>
      )}
    </div>
  );
}
