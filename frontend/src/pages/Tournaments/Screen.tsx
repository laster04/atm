import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tournamentSeriesApi } from '@/services/api';
import type { TournamentSeries } from '@types';
import { Card, CardContent, CardHeader, CardTitle } from '@components/base/card';
import { Badge } from '@components/base/badge';
import { Trophy } from 'lucide-react';

export default function TournamentsScreen() {
  useTranslation();
  useDocumentTitle(['Tournaments']);
  const [series, setSeries] = useState<TournamentSeries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tournamentSeriesApi.getAll()
      .then(r => setSeries(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="size-7 text-primary" />
        <h1 className="text-2xl font-bold">Tournaments</h1>
      </div>

      {series.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">No tournaments yet.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {series.map(s => (
            <Link key={s.id} to={`/tournaments/${s.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    {s.logo ? (
                      <img src={s.logo} alt={s.name} className="size-10 object-contain" />
                    ) : (
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                        <Trophy className="size-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      <Badge variant="outline" className="text-xs mt-1">{s.sportType}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {s.description && <p className="text-sm text-muted-foreground mb-2">{s.description}</p>}
                  <p className="text-sm text-muted-foreground">
                    {s._count?.tournaments ?? 0} edition{(s._count?.tournaments ?? 0) !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
