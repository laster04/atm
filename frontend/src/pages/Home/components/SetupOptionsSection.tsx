import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Users,
  Calendar,
  Users2,
  BarChart3,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface SetupOption {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  link?: string;
}

const setupOptions: SetupOption[] = [
  {
    id: 'league-config',
    titleKey: 'home.setupOptions.leagueConfiguration.title',
    descriptionKey: 'home.setupOptions.leagueConfiguration.description',
    icon: Settings,
  },
  {
    id: 'team-mgmt',
    titleKey: 'home.setupOptions.teamManagement.title',
    descriptionKey: 'home.setupOptions.teamManagement.description',
    icon: Users,
    link: '/admin',
  },
  {
    id: 'game-schedule',
    titleKey: 'home.setupOptions.gameScheduling.title',
    descriptionKey: 'home.setupOptions.gameScheduling.description',
    icon: Calendar,
  },
  {
    id: 'player-mgmt',
    titleKey: 'home.setupOptions.playerManagement.title',
    descriptionKey: 'home.setupOptions.playerManagement.description',
    icon: Users2,
  },
  {
    id: 'reporting',
    titleKey: 'home.setupOptions.reporting.title',
    descriptionKey: 'home.setupOptions.reporting.description',
    icon: BarChart3,
  },
  {
    id: 'permissions',
    titleKey: 'home.setupOptions.permissions.title',
    descriptionKey: 'home.setupOptions.permissions.description',
    icon: Lock,
  },
];

export default function SetupOptionsSection(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="mb-16 py-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {t('home.setupOptions.title')}
        </h2>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          {t('home.setupOptions.description')}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {setupOptions.map((option) => {
          const IconComponent = option.icon;
          const cardContent = (
            <div className="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-100 h-full">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
                <IconComponent className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t(option.titleKey)}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {t(option.descriptionKey)}
              </p>
            </div>
          );

          if (option.link) {
            return (
              <Link key={option.id} to={option.link} className="block">
                {cardContent}
              </Link>
            );
          }

          return (
            <div key={option.id}>
              {cardContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
