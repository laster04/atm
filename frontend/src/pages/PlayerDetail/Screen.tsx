import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { playerApi, gameStatisticApi } from '@/services/api';
import type { Player, GameStatistic } from '@types';

import PlayerHeader from './components/PlayerHeader';
import PlayerInfo from './components/PlayerInfo';
import PlayerStatistics from './components/PlayerStatistics';
import PlayerTeam from './components/PlayerTeam';

export default function PlayerDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const [player, setPlayer] = useState<Player | null>(null);
  const [statistics, setStatistics] = useState<GameStatistic[]>([]);
  const [loading, setLoading] = useState(false);

  useDocumentTitle([player?.name, player?.team?.name]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      playerApi.getById(id),
      gameStatisticApi.getByPlayer(id)
    ])
      .then(([playerRes, statsRes]) => {
        setPlayer(playerRes.data);
        setStatistics(statsRes.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading && !player) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('playerDetail.loading')}</div>
    );
  }

  if (!player) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('playerDetail.notFound')}</div>
    );
  }

  // Calculate totals
  const totalGoals = statistics.reduce((sum, s) => sum + (s.goals || 0), 0);
  const totalAssists = statistics.reduce((sum, s) => sum + (s.assists || 0), 0);
  const gamesPlayed = statistics.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PlayerHeader player={player} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PlayerInfo player={player} />
          <PlayerStatistics
            statistics={statistics}
            totalGoals={totalGoals}
            totalAssists={totalAssists}
            gamesPlayed={gamesPlayed}
          />
        </div>

        <div>
          <PlayerTeam player={player} />
        </div>
      </div>
    </div>
  );
}
