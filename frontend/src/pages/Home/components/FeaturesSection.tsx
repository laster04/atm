import { useTranslation } from 'react-i18next';

export default function FeaturesSection() {
  const { t } = useTranslation();

  const features = [
    {
      title: t('home.features.leagueManagement.title'),
      description: t('home.features.leagueManagement.description'),
    },
    {
      title: t('home.features.autoScheduling.title'),
      description: t('home.features.autoScheduling.description'),
    },
    {
      title: t('home.features.liveStandings.title'),
      description: t('home.features.liveStandings.description'),
    },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-6 mb-12">
      {features.map((feature, index) => (
        <div key={index} className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
          <p className="text-gray-600">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}
