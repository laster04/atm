import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Zap,
  Users,
  BarChart3,
  Calendar,
  Trophy,
  Target,
  type LucideIcon,
} from 'lucide-react';

interface FeatureItem {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
}

const features: FeatureItem[] = [
  {
    id: 'league-mgmt',
    titleKey: 'home.appInfo.features.leagueManagement.title',
    descriptionKey: 'home.appInfo.features.leagueManagement.description',
    icon: Trophy,
  },
  {
    id: 'auto-schedule',
    titleKey: 'home.appInfo.features.autoScheduling.title',
    descriptionKey: 'home.appInfo.features.autoScheduling.description',
    icon: Calendar,
  },
  {
    id: 'live-standings',
    titleKey: 'home.appInfo.features.liveStandings.title',
    descriptionKey: 'home.appInfo.features.liveStandings.description',
    icon: BarChart3,
  },
  {
    id: 'team-mgmt',
    titleKey: 'home.appInfo.features.teamManagement.title',
    descriptionKey: 'home.appInfo.features.teamManagement.description',
    icon: Users,
  },
  {
    id: 'player-tracking',
    titleKey: 'home.appInfo.features.playerTracking.title',
    descriptionKey: 'home.appInfo.features.playerTracking.description',
    icon: Target,
  },
  {
    id: 'performance',
    titleKey: 'home.appInfo.features.performance.title',
    descriptionKey: 'home.appInfo.features.performance.description',
    icon: Zap,
  },
];

export default function ApplicationInfoSection(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="mb-16 py-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {t('home.appInfo.title')}
        </h2>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          {t('home.appInfo.description')}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {features.map((feature) => {
          const IconComponent = feature.icon;
          return (
            <div
              key={feature.id}
              className="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-100"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                <IconComponent className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t(feature.titleKey)}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {t(feature.descriptionKey)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
