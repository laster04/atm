import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Trophy } from 'lucide-react';
import { leagueApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { SeasonStatus, type League } from '@types';
import { EmptyState, PublicHero } from '@/components/public';
import SeasonCard from '@/pages/Seasons/components/SeasonCard';

export default function LeagueDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentTitle([league?.name]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    leagueApi.getById(id)
      .then((res) => setLeague(res.data))
      .catch((error) => console.error('Failed to fetch league data:', error))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading && !league) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
        {t('leagueDetail.loading')}
      </div>
    );
  }

  if (!league) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-muted-foreground sm:px-8">
        {t('leagueDetail.notFound')}
      </div>
    );
  }

  // Newest first: a league page opens on what is being played, not its history.
  const seasons = [...(league.seasons ?? [])].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
  const active = seasons.filter((season) => season.status === SeasonStatus.ACTIVE).length;

  return (
    <>
      <PublicHero
        title={league.name}
        subtitle={league.description || undefined}
        sport={league.sportType}
        crumbs={[
          { label: t('public.nav.home'), to: '/' },
          { label: t('public.nav.leagues'), to: '/leagues' },
          { label: league.name },
        ]}
        badge={
          <span className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand">
            {t(`sports.${league.sportType}`)}
          </span>
        }
        meta={
          <>
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 text-brand" />
              {t('public.leagues.seasonCount', { count: seasons.length })}
            </span>
            {active > 0 && (
              <span className="flex items-center gap-2">
                <Trophy className="size-4 text-brand" />
                {t('public.leagues.activeCount', { count: active })}
              </span>
            )}
          </>
        }
      />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-7 sm:px-8">
        <h2 className="text-xl font-extrabold tracking-tight">{t('leagueDetail.seasons')}</h2>
        {seasons.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-7" />}
            title={t('leagueDetail.noSeasons')}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {seasons.map((season) => (
              <SeasonCard key={season.id} season={{ ...season, league }} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
