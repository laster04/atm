import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Game } from '@types';

interface ScheduleListProps {
  games: Game[];
}

export default function ScheduleList({ games }: ScheduleListProps) {
  const { t, i18n } = useTranslation();

  const formatDate = (date: string) => {
    const locale = i18n.language === 'cs' ? 'cs-CZ' : 'en-US';
    return new Date(date).toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (games.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
        {t('seasonDetail.schedule.noGames')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {games.map((game) => (
        <div key={game.id} className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-right pr-4">
              <Link to={`/teams/${game.homeTeam?.id}`} className="font-medium hover:text-blue-600">
                {game.homeTeam?.name}
              </Link>
            </div>
            <div className="text-center px-4">
              {game.status === 'COMPLETED' ? (
                <span className="text-2xl font-bold">
                  {game.homeScore} - {game.awayScore}
                </span>
              ) : (
                <span className="text-gray-400">{t('common.vs')}</span>
              )}
            </div>
            <div className="flex-1 pl-4">
              <Link to={`/teams/${game.awayTeam?.id}`} className="font-medium hover:text-blue-600">
                {game.awayTeam?.name}
              </Link>
            </div>
          </div>
          <div className="text-center mt-2 text-sm text-gray-500">
            {formatDate(game.date)}
            {game.location && ` · ${game.location}`}
            {game.round && ` · ${t('seasonDetail.schedule.round', { round: game.round })}`}
          </div>
        </div>
      ))}
    </div>
  );
}
