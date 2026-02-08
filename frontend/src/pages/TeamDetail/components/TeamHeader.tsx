import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Team } from '@types';
import { Button } from "@components/base/button.tsx";

interface TeamHeaderProps {
  team: Team;
}

export default function TeamHeader({ team }: TeamHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-6">
          <Button variant="outline" >
              <Link to={`/season-detail/${team.season?.id}`} >
                  ← {t('teamDetail.backTo', { name: team.season?.name })}
              </Link>
          </Button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6"
           style={{
               backgroundColor: `${team?.primaryColor}35`,
               borderLeft: `4px solid ${team?.primaryColor}`
           }}>
        <h1 className="text-3xl font-bold mb-2">{team.name}</h1>
        <p className="text-gray-600">
          {team.season?.name} · {team.season?.league?.name || '-'}
        </p>
        {team.manager && (
          <p className="text-gray-500 mt-2">
            {t('teamDetail.manager', { name: team.manager.name })}
          </p>
        )}
      </div>
    </>
  );
}
