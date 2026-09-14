import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { playerApi, gameStatisticApi } from '@/services/api';
import type { Player, HockeyGameStatistic } from '@types';
import { PlayerHeroBand } from '@/components/public';
import PlayerInfo from './components/PlayerInfo';
import PlayerStatistics from './components/PlayerStatistics';
import PlayerTeam from './components/PlayerTeam';

export default function PlayerDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const [player, setPlayer] = useState<Player | null>(null);
  const [statistics, setStatistics] = useState<HockeyGameStatistic[]>([]);
  const [loading, setLoading] = useState(false);

  useDocumentTitle([player?.name, player?.team?.name]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([playerApi.getById(id), gameStatisticApi.getByPlayer(id)])
      .then(([playerRes, statsRes]) => {
        setPlayer(playerRes.data);
        setStatistics(statsRes.data);
      })
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading && !player) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
        {t('playerDetail.loading')}
      </div>
    );
  }

  if (!player) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
        {t('playerDetail.notFound')}
      </div>
    );
  }

  const totals = statistics.reduce(
    (sum, stat) => ({
      goals: sum.goals + (stat.goals || 0),
      assists: sum.assists + (stat.assists || 0),
      penaltyMinutes: sum.penaltyMinutes + (stat.penaltyMinutes || 0),
    }),
    { goals: 0, assists: 0, penaltyMinutes: 0 }
  );

  return (
    <>
      <PlayerHeroBand
        player={player}
        crumbs={[
          { label: t('public.nav.home'), to: '/' },
          { label: t('public.players.title'), to: '/players' },
          ...(player.team ? [{ label: player.team.name, to: `/teams/${player.team.id}` }] : []),
          { label: player.name },
        ]}
      />

      <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PlayerStatistics
          statistics={statistics}
          totalGoals={totals.goals}
          totalAssists={totals.assists}
          totalPenaltyMinutes={totals.penaltyMinutes}
          gamesPlayed={statistics.length}
        />

        <div className="flex flex-col gap-5">
          <PlayerTeam player={player} />
          <PlayerInfo player={player} />
        </div>
      </div>
    </>
  );
}
