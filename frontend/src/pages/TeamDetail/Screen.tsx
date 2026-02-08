import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { teamApi, playerApi, gameStatisticApi } from '@/services/api';
import type { Player, Team, TopScorer } from '@types';

import TeamHeader from './components/TeamHeader';
import RosterTable from './components/RosterTable';
import GamesList from './components/GamesList';

export default function TeamDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [loading, setLoading] = useState(false);

  useDocumentTitle([team?.season?.league?.name, team?.season?.name, team?.name]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      teamApi.getById(id),
      playerApi.getByTeam(id),
    ])
      .then(([teamRes, playersRes]) => {
        setTeam(teamRes.data);
        setPlayers(playersRes.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!team?.season) return;
    gameStatisticApi.getScorersBySeasonAndTeam(team.season.id, team.id)
        .then((res) => {
          setTopScorers(res.data)
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
  }, [team]);

  if (loading && !team) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('teamDetail.loading')}</div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('teamDetail.notFound')}</div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <TeamHeader team={team} />

      <div className="grid lg:grid-cols-2 gap-6">
        <RosterTable
            topScorers={topScorers || []}
          players={players.length > 0 ? players : team.players || []}
        />

        <GamesList games={team.games || []} teamId={team.id} />
      </div>
    </div>
  );
}
