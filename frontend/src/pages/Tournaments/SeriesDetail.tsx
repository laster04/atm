import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tournamentSeriesApi } from '@/services/api';
import type { TournamentSeries } from '@types';
import { Card, CardContent, CardHeader, CardTitle } from '@components/base/card';
import { Badge } from '@components/base/badge';
import { Trophy, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'outline',
  REGISTRATION: 'secondary',
  GROUP_STAGE: 'default',
  PLAYOFF: 'default',
  COMPLETED: 'secondary',
};

export default function TournamentSeriesDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [series, setSeries] = useState<TournamentSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const tennisCtx = series?.sportType === 'TENNIS' ? 'TENNIS' : undefined;

  useDocumentTitle([series?.name]);

  useEffect(() => {
    if (!id) return;
    tournamentSeriesApi.getById(id)
      .then(r => setSeries(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!series) return <div className="p-8 text-center text-red-500">Not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/tournaments" className="hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="size-4" /> Tournaments
        </Link>
        <span>/</span>
        <span className="text-foreground">{series.name}</span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {series.logo ? (
              <img src={series.logo} alt={series.name} className="size-12 object-contain" />
            ) : (
              <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                <Trophy className="size-6 text-primary" />
              </div>
            )}
            <div>
              <CardTitle>{series.name}</CardTitle>
              <Badge variant="outline" className="mt-1">{series.sportType}</Badge>
            </div>
          </div>
          {series.description && <p className="text-sm text-muted-foreground mt-2">{series.description}</p>}
        </CardHeader>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3">Editions</h2>
        {(!series.tournaments || series.tournaments.length === 0) ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">No editions yet.</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {series.tournaments.map(edition => (
              <Link key={edition.id} to={`/tournament/${edition.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{edition.name}</span>
                        {edition.year && <span className="text-muted-foreground text-sm">{edition.year}</span>}
                        <Badge variant={STATUS_VARIANT[edition.status] ?? 'outline'} className="text-xs">
                          {edition.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {edition._count && <span>{t('tournamentDetail.teamsCount', { count: edition._count.teams, context: tennisCtx })}</span>}
                        <ChevronRight className="size-4" />
                      </div>
                    </div>
                    {edition.location && <div className="text-xs text-muted-foreground mt-1">{edition.location}</div>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
