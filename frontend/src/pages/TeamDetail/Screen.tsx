import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { gameStatisticApi, playerApi, seasonApi, teamApi } from '@/services/api';
import { GameStatus, type Player, type Standing, type Team, type TopScorer } from '@types';
import { Panel } from '@/components/public';
import TeamHeroBand from '@/components/public/TeamHeroBand';
import RosterTable from './components/RosterTable';
import GamesList, { resultOf } from './components/GamesList';
import InviteManagerModal from '../TeamManager/components/InviteManagerModal';

const FORM_TONE: Record<string, string> = {
  W: 'bg-success-soft text-success-strong',
  D: 'bg-muted text-subtle-foreground',
  L: 'bg-destructive-soft text-destructive-strong',
};

export default function TeamDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useDocumentTitle([team?.season?.league?.name, team?.season?.name, team?.name]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([teamApi.getById(id), playerApi.getByTeam(id)])
      .then(([teamRes, playersRes]) => {
        setTeam(teamRes.data);
        setPlayers(playersRes.data);
      })
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, [id]);

  // The team's own row in the table gives the page its rank, points and record;
  // a team outside a season simply has none.
  useEffect(() => {
    if (!team?.season) return;
    gameStatisticApi.getScorersBySeasonAndTeam(team.season.id, team.id)
      .then((res) => setTopScorers(res.data))
      .catch((error) => console.error(error));
    seasonApi.getTeamStanding(team.season.id, team.id)
      .then((res) => setStanding(res.data))
      .catch((error) => console.error(error));
  }, [team]);

  if (loading && !team) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
        {t('teamDetail.loading')}
      </div>
    );
  }

  if (!team) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
        {t('teamDetail.notFound')}
      </div>
    );
  }

  const games = team.games || [];
  const form = games
    .filter((game) => game.status === GameStatus.COMPLETED)
    .slice(-6)
    .map((game) => resultOf(game, team.id));

  const figures = standing
    ? [
        { label: t('teamDetail.figures.rank'), value: `${standing.rank}.` },
        { label: t('teamDetail.figures.points'), value: standing.points },
        { label: t('teamDetail.figures.record'), value: `${standing.goalsFor}:${standing.goalsAgainst}` },
      ]
    : undefined;

  return (
    <>
      <TeamHeroBand
        team={team}
        crumbs={[
          { label: t('public.nav.home'), to: '/' },
          ...(team.season
            ? [
                { label: t('public.seasons.title'), to: '/seasons' },
                { label: team.season.name, to: `/season-detail/${team.season.id}` },
              ]
            : [{ label: t('public.teams.title'), to: '/teams' }]),
          { label: team.name },
        ]}
        subtitle={
          <>
            {team.season?.league?.name && <span>{team.season.league.name}</span>}
            {team.season && <span className="text-white/40">·</span>}
            {team.season && <span>{team.season.name}</span>}
            <span className="text-white/40">·</span>
            <span>{t('public.players.count', { count: players.length || team.players?.length || 0 })}</span>
            {team.manager && (
              <>
                <span className="text-white/40">·</span>
                <span>{t('teamDetail.manager', { name: team.manager.name })}</span>
              </>
            )}
          </>
        }
        figures={figures}
      />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-7 sm:px-8">
        {team.canAdminister && (
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="flex h-10 items-center self-start rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t('teamDetail.inviteManager.button')}
          </button>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <Panel title={t('teamDetail.form.title', { count: form.length })}>
            {form.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">{t('teamDetail.form.none')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  {form.map((result, index) => (
                    <span
                      key={index}
                      className={`flex size-9 items-center justify-center rounded-lg text-sm font-extrabold ${FORM_TONE[result]}`}
                    >
                      {t(`teamDetail.games.result.${result}`).charAt(0)}
                    </span>
                  ))}
                </div>
                {standing && (
                  <div className="flex items-center gap-6 border-t border-border-subtle pt-4">
                    <Figure value={standing.played} label={t('seasonDetail.standings.played')} />
                    <Figure value={standing.wins} label={t('seasonDetail.standings.wins')} tone="text-success-strong" />
                    <Figure value={standing.draws} label={t('seasonDetail.standings.draws')} />
                    <Figure value={standing.losses} label={t('seasonDetail.standings.losses')} tone="text-destructive-strong" />
                  </div>
                )}
              </div>
            )}
          </Panel>

          <GamesList games={games} teamId={team.id} seasonId={team.season?.id} />
        </div>

        <RosterTable
          team={team}
          topScorers={topScorers}
          players={players.length > 0 ? players : team.players || []}
        />
      </div>

      {showInviteModal && (
        <InviteManagerModal
          teamId={team.id}
          onSuccess={(updatedTeam) => {
            setTeam(updatedTeam);
            setShowInviteModal(false);
          }}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </>
  );
}

function Figure({ value, label, tone = '' }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-xl font-extrabold leading-none ${tone}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
