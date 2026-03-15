import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@components/base/button';

interface PricingTier {
  id: string;
  nameKey: string;
  priceKey: string;
  descriptionKey: string;
  featuresKeys: string[];
  highlighted?: boolean;
  ctaKey: string;
}

const pricingTiers: PricingTier[] = [
  {
    id: 'free',
    nameKey: 'home.pricing.tiers.free.name',
    priceKey: 'home.pricing.tiers.free.price',
    descriptionKey: 'home.pricing.tiers.free.description',
    ctaKey: 'home.pricing.tiers.free.cta',
    featuresKeys: [
      'home.pricing.tiers.free.feature1',
      'home.pricing.tiers.free.feature2',
      'home.pricing.tiers.free.feature3',
      'home.pricing.tiers.free.feature4',
    ],
  },
  {
    id: 'pro',
    nameKey: 'home.pricing.tiers.pro.name',
    priceKey: 'home.pricing.tiers.pro.price',
    descriptionKey: 'home.pricing.tiers.pro.description',
    ctaKey: 'home.pricing.tiers.pro.cta',
    highlighted: true,
    featuresKeys: [
      'home.pricing.tiers.pro.feature1',
      'home.pricing.tiers.pro.feature2',
      'home.pricing.tiers.pro.feature3',
      'home.pricing.tiers.pro.feature4',
      'home.pricing.tiers.pro.feature5',
      'home.pricing.tiers.pro.feature6',
    ],
  },
  {
    id: 'enterprise',
    nameKey: 'home.pricing.tiers.enterprise.name',
    priceKey: 'home.pricing.tiers.enterprise.price',
    descriptionKey: 'home.pricing.tiers.enterprise.description',
    ctaKey: 'home.pricing.tiers.enterprise.cta',
    featuresKeys: [
      'home.pricing.tiers.enterprise.feature1',
      'home.pricing.tiers.enterprise.feature2',
      'home.pricing.tiers.enterprise.feature3',
      'home.pricing.tiers.enterprise.feature4',
      'home.pricing.tiers.enterprise.feature5',
      'home.pricing.tiers.enterprise.feature6',
      'home.pricing.tiers.enterprise.feature7',
    ],
  },
];

export default function PricingSection(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="mb-16 py-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {t('home.pricing.title')}
        </h2>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          {t('home.pricing.description')}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {pricingTiers.map((tier) => (
          <div
            key={tier.id}
            className={`rounded-lg p-8 transition-all ${
              tier.highlighted
                ? 'bg-blue-50 border-2 border-blue-600 shadow-lg relative scale-105'
                : 'bg-white border border-gray-200 shadow-sm'
            }`}
          >
            {tier.highlighted && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                {t('home.pricing.mostPopular')}
              </div>
            )}

            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {t(tier.nameKey)}
            </h3>
            <p className="text-gray-600 text-sm mb-4">{t(tier.descriptionKey)}</p>

            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">
                {t(tier.priceKey)}
              </span>
            </div>

            <Button
              className={`w-full mb-8 ${
                tier.highlighted
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
              size="lg"
            >
              {t(tier.ctaKey)}
            </Button>

            <div className="space-y-3">
              {tier.featuresKeys.map((featureKey, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 text-sm">{t(featureKey)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
