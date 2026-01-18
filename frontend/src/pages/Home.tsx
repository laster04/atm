import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { seasonApi, teamApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Season, Team } from '../types';

export default function Home() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { user, isTeamManager } = useAuth();

  useEffect(() => {
    seasonApi.getAll()
      .then(res => setSeasons(res.data.filter(s => s.status === 'ACTIVE').slice(0, 3)))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isTeamManager()) {
      teamApi.getMyTeams()
        .then(res => setMyTeams(res.data))
        .catch(err => console.error(err));
    }
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {t('home.title')}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          {t('home.subtitle')}
        </p>
      </div>

      {isTeamManager() && myTeams.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">{t('home.myTeams')}</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {myTeams.map(team => (
              <Link
                key={team.id}
                to={`/teams/${team.id}`}
                className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-blue-500"
              >
                <h3 className="font-semibold text-lg">{team.name}</h3>
                <p className="text-gray-600">{team.season?.name}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {team._count?.players} {t('common.players')}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">{t('home.features.leagueManagement.title')}</h3>
          <p className="text-gray-600">
            {t('home.features.leagueManagement.description')}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">{t('home.features.autoScheduling.title')}</h3>
          <p className="text-gray-600">
            {t('home.features.autoScheduling.description')}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">{t('home.features.liveStandings.title')}</h3>
          <p className="text-gray-600">
            {t('home.features.liveStandings.description')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">{t('common.loading')}</div>
      ) : seasons.length > 0 ? (
        <div>
          <h2 className="text-2xl font-bold mb-4">{t('home.activeSeasons')}</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {seasons.map(season => (
              <Link
                key={season.id}
                to={`/seasons/${season.id}`}
                className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-lg">{season.name}</h3>
                <p className="text-gray-600">{season.sportType}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {season._count?.teams} {t('common.teams')} · {season._count?.games} {t('common.games')}
                </p>
              </Link>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link
              to="/seasons"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              {t('home.viewAllSeasons')} →
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-gray-500 mb-4">{t('home.noActiveSeasons')}</p>
          <Link
            to="/seasons"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            {t('home.viewAllSeasons')} →
          </Link>
        </div>
      )}
    </div>
  );
}
