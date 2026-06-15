import { useTranslation } from 'react-i18next';
import { formatGameDateTime } from '@/utils/date';
import type { Game } from '@types';

interface GamesListProps {
  games: Game[];
  teamId: number;
}

export default function GamesList({ games, teamId }: GamesListProps) {
  const { t, i18n } = useTranslation();

  const upcomingGames = games.filter((g) => g.status === 'SCHEDULED');
  const completedGames = games.filter((g) => g.status === 'COMPLETED');

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{t('teamDetail.games.title')}</h2>
      <div className="space-y-4">
        {upcomingGames.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">
              {t('teamDetail.games.upcoming')}
            </h3>
            {upcomingGames.slice(0, 5).map((game) => (
              <div key={game.id} className="bg-white p-3 rounded-lg shadow mb-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {game.homeTeamId === teamId ? 'vs' : '@'}{' '}
                    {game.homeTeamId === teamId ? game.awayTeam?.name : game.homeTeam?.name}
                  </span>
                  <span className="text-sm text-gray-500">{formatGameDateTime(game.date, i18n.language)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {completedGames.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">
              {t('teamDetail.games.recentResults')}
            </h3>
            {completedGames
              .slice(-5)
              .reverse()
              .map((game) => {
                const isHome = game.homeTeamId === teamId;
                const teamScore = isHome ? game.homeScore : game.awayScore;
                const oppScore = isHome ? game.awayScore : game.homeScore;
                const result =
                  (teamScore ?? 0) > (oppScore ?? 0)
                    ? 'W'
                    : (teamScore ?? 0) < (oppScore ?? 0)
                      ? 'L'
                      : 'D';
                const resultColor =
                  result === 'W'
                    ? 'text-green-600'
                    : result === 'L'
                      ? 'text-red-600'
                      : 'text-gray-600';

                return (
                  <div key={game.id} className="bg-white p-3 rounded-lg shadow mb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className={`font-bold ${resultColor} mr-2`}>{result}</span>
                        <span className="font-medium">
                          {isHome ? 'vs' : '@'}{' '}
                          {isHome ? game.awayTeam?.name : game.homeTeam?.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">
                          {teamScore} - {oppScore}
                        </span>
                        {isHome
                          ? (game.period1HomeScore != null || game.period2HomeScore != null || game.period3HomeScore != null) && (
                            <div className="flex gap-2 text-xs text-gray-400 justify-end">
                              {game.period1HomeScore != null && <span>P1: {game.period1HomeScore}-{game.period1AwayScore}</span>}
                              {game.period2HomeScore != null && <span>P2: {game.period2HomeScore}-{game.period2AwayScore}</span>}
                              {game.period3HomeScore != null && <span>P3: {game.period3HomeScore}-{game.period3AwayScore}</span>}
                            </div>
                          )
                          : (game.period1AwayScore != null || game.period2AwayScore != null || game.period3AwayScore != null) && (
                            <div className="flex gap-2 text-xs text-gray-400 justify-end">
                              {game.period1AwayScore != null && <span>P1: {game.period1AwayScore}-{game.period1HomeScore}</span>}
                              {game.period2AwayScore != null && <span>P2: {game.period2AwayScore}-{game.period2HomeScore}</span>}
                              {game.period3AwayScore != null && <span>P3: {game.period3AwayScore}-{game.period3HomeScore}</span>}
                            </div>
                          )
                        }
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {upcomingGames.length === 0 && completedGames.length === 0 && (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            {t('teamDetail.games.noGames')}
          </div>
        )}
      </div>
    </div>
  );
}
