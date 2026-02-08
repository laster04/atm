import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Season } from '@types';
import { Button } from "@components/base/button";
import { ArrowRight } from "lucide-react";

interface ActiveSeasonsSectionProps {
  seasons: Season[];
  loading: boolean;
}

export default function ActiveSeasonsSection({ seasons, loading }: ActiveSeasonsSectionProps) {
  const { t } = useTranslation();

  if (loading) {
    return <div className="text-center text-gray-500">{t('common.loading')}</div>;
  }

  if (seasons.length === 0) {
    return (
      <div className="text-center">
        <p className="text-gray-500 mb-4">{t('home.noActiveSeasons')}</p>
        <Link to="/seasons" className="text-blue-600 hover:text-blue-800 font-medium">
          {t('home.viewAllSeasons')} →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">{t('home.activeSeasons')}</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {seasons.map((season) => (
          <Link
            key={season.id}
            to={`/season-detail/${season.id}`}
            className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="font-semibold text-lg">{season.name}</h3>
            <p className="text-gray-600">{season.league?.name || '-'}</p>
            <p className="text-sm text-gray-500 mt-2">
              {season._count?.seasonTeams ?? season._count?.teams ?? 0} {t('common.teams')} · {season._count?.games} {t('common.games')}
            </p>
          </Link>
        ))}
      </div>
      <div className="text-center mt-6">
        <Link to="/seasons" className="font-medium">
            <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
            >
                {t('home.viewAllSeasons')}
                <ArrowRight className="size-4 ml-2" />
            </Button>
        </Link>
      </div>
    </div>
  );
}
