import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TopScorer } from '@/services/api';

interface TopScorersProps {
  topScorers: TopScorer[];
  loading?: boolean;
}

export default function TopScorers({ topScorers, loading }: TopScorersProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }

  if (topScorers.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        {t('seasonDetail.overview.noTopScorers')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {topScorers.map((scorer, index) => (
          <div
              key={scorer.player.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                          index === 2 ? 'bg-amber-600 text-amber-100' :
                              'bg-muted-foreground/20 text-muted-foreground'
              }`}>
                {index + 1}
              </div>
              <div>
                <Link
                    to={`/players/${scorer.player.id}`}
                    className="font-medium transition-colors"
                >
                  {scorer.player.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {scorer.player.team?.name}
                  {scorer.player.number && ` · #${scorer.player.number}`}
                </div>
              </div>
            </div>
            <div className="text-xl font-medium">{scorer.points} pts</div>
          </div>
      ))}
    </div>
  );
}
