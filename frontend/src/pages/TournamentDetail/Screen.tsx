import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tournamentApi } from '@/services/api';
import type { Tournament, TournamentStanding } from '@types';
import { Card, CardContent, CardHeader, CardTitle } from '@components/base/card';
import { Badge } from '@components/base/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/base/tabs';
import { Trophy, Calendar, MapPin, Users, ChevronLeft } from 'lucide-react';
import GroupStandings from './components/GroupStandings';
import PlayoffBracket from './components/PlayoffBracket';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'outline',
  REGISTRATION: 'secondary',
  GROUP_STAGE: 'default',
  PLAYOFF: 'default',
  COMPLETED: 'secondary',
};

export default function TournamentDetailScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [standings, setStandings] = useState<Record<number, TournamentStanding[]>>({});
  const [loading, setLoading] = useState(true);

  useDocumentTitle([tournament?.name, tournament?.series?.name]);

  useEffect(() => {
    if (!id) return;
    tournamentApi.getById(id).then(async (tRes) => {
      const t = tRes.data;
      setTournament(t);

      if (t.groups && t.groups.length > 0) {
        const standingsByGroup: Record<number, TournamentStanding[]> = {};
        await Promise.all(
          t.groups.map(async g => {
            const res = await tournamentApi.getStandings(id, g.id);
            standingsByGroup[g.id] = res.data;
          })
        );
        setStandings(standingsByGroup);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">{t('tournamentDetail.loading')}</div>;
  if (!tournament) return <div className="p-8 text-center text-red-500">{t('tournamentDetail.notFound')}</div>;

  const groupGames = tournament.games?.filter(g => g.phase === 'GROUP') ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/tournaments" className="hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="size-4" /> {t('tournamentDetail.breadcrumb')}
        </Link>
        <span>/</span>
        {tournament.series && (
          <>
            <Link to={`/tournaments/${tournament.series.id}`} className="hover:text-foreground">
              {tournament.series.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground">{tournament.name}</span>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                <Trophy className="size-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{tournament.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={STATUS_VARIANT[tournament.status] ?? 'outline'}>
                    {t(`tm.tournamentStatus.${tournament.status}`, tournament.status)}
                  </Badge>
                  {tournament.year && <span className="text-sm text-muted-foreground">{tournament.year}</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
            {tournament.location && (
              <span className="flex items-center gap-1"><MapPin className="size-4" />{tournament.location}</span>
            )}
            {tournament.startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="size-4" />
                {new Date(tournament.startDate).toLocaleDateString()}
                {tournament.endDate && ` – ${new Date(tournament.endDate).toLocaleDateString()}`}
              </span>
            )}
            {tournament._count && (
              <span className="flex items-center gap-1"><Users className="size-4" />{t('tournamentDetail.teamsCount', { count: tournament._count.teams })}</span>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="groups">
        <TabsList>
          <TabsTrigger value="groups">{t('tournamentDetail.tabs.groups')}</TabsTrigger>
          <TabsTrigger value="schedule">{t('tournamentDetail.tabs.schedule')}</TabsTrigger>
          <TabsTrigger value="playoff">{t('tournamentDetail.tabs.playoff')}</TabsTrigger>
          <TabsTrigger value="teams">{t('tournamentDetail.tabs.teams')}</TabsTrigger>
        </TabsList>

        {/* Groups + standings */}
        <TabsContent value="groups" className="space-y-6 mt-4">
          {(!tournament.groups || tournament.groups.length === 0) ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">{t('tournamentDetail.groups.empty')}</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {tournament.groups.map(group => (
                <GroupStandings
                  key={group.id}
                  group={group}
                  standings={standings[group.id] ?? []}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Group games */}
        <TabsContent value="schedule" className="mt-4 space-y-3">
          {groupGames.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">{t('tournamentDetail.schedule.empty')}</CardContent></Card>
          ) : (
            groupGames.map(game => (
              <Card key={game.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="font-medium">{game.homeTeam?.name ?? t('tm.common.tbd')}</span>
                    </div>
                    <div className="flex flex-col items-center min-w-[80px]">
                      {game.status === 'COMPLETED' ? (
                        <span className="text-xl font-bold">{game.homeScore} – {game.awayScore}</span>
                      ) : (
                        <span className="text-muted-foreground">vs</span>
                      )}
                      {game.group && <span className="text-xs text-muted-foreground">{t('tournamentDetail.schedule.groupLabel', { name: game.group.name })}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium">{game.awayTeam?.name ?? t('tm.common.tbd')}</span>
                    </div>
                  </div>
                  {game.date && (
                    <div className="text-center text-xs text-muted-foreground mt-1">
                      {new Date(game.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      {game.location && ` · ${game.location}`}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Playoff bracket */}
        <TabsContent value="playoff" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('tournamentDetail.playoff.title')}</CardTitle></CardHeader>
            <CardContent>
              <PlayoffBracket games={tournament.games ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teams */}
        <TabsContent value="teams" className="mt-4">
          {(!tournament.teams || tournament.teams.length === 0) ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">{t('tournamentDetail.teams.empty')}</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tournament.teams.map(team => (
                <Card key={team.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      {team.primaryColor && (
                        <div className="size-8 rounded-full" style={{ backgroundColor: team.primaryColor }} />
                      )}
                      <div>
                        <div className="font-medium">{team.name}</div>
                        {team.country && <div className="text-xs text-muted-foreground">{team.country}</div>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
