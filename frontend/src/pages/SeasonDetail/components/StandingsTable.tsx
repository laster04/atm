import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Standing } from '@types';

interface StandingsTableProps {
  standings: Standing[];
}

export default function StandingsTable({ standings }: StandingsTableProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
              {t('seasonDetail.standings.rank')}
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
              {t('seasonDetail.standings.team')}
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
              {t('seasonDetail.standings.played')}
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
              {t('seasonDetail.standings.wins')}
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
              {t('seasonDetail.standings.draws')}
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
              {t('seasonDetail.standings.losses')}
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
              {t('seasonDetail.standings.goalsFor')}
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
              {t('seasonDetail.standings.goalsAgainst')}
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
              {t('seasonDetail.standings.goalDifference')}
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
              {t('seasonDetail.standings.points')}
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, idx) => (
            <tr key={row.team.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-3 text-sm">{idx + 1}</td>
              <td className="px-4 py-3">
                <Link to={`/teams/${row.team.id}`} className="font-medium hover:text-blue-600">
                  {row.team.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-center text-sm">{row.played}</td>
              <td className="px-4 py-3 text-center text-sm">{row.wins}</td>
              <td className="px-4 py-3 text-center text-sm">{row.draws}</td>
              <td className="px-4 py-3 text-center text-sm">{row.losses}</td>
              <td className="px-4 py-3 text-center text-sm">{row.goalsFor}</td>
              <td className="px-4 py-3 text-center text-sm">{row.goalsAgainst}</td>
              <td className="px-4 py-3 text-center text-sm">{row.goalDifference}</td>
              <td className="px-4 py-3 text-center font-bold">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {standings.length === 0 && (
        <div className="p-8 text-center text-gray-500">{t('seasonDetail.standings.noData')}</div>
      )}
    </div>
  );
}
