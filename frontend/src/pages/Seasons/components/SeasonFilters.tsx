import { useTranslation } from 'react-i18next';
import { SeasonStatus } from '@types';

type FilterValue = 'all' | SeasonStatus;

interface SeasonFiltersProps {
  filter: FilterValue;
  onFilterChange: (filter: FilterValue) => void;
}

export default function SeasonFilters({ filter, onFilterChange }: SeasonFiltersProps) {
  const { t } = useTranslation();

  const filters: FilterValue[] = ['all', SeasonStatus.ACTIVE, SeasonStatus.DRAFT, SeasonStatus.COMPLETED];

  return (
    <div className="flex gap-2">
      {filters.map((status) => (
        <button
          key={status}
          onClick={() => onFilterChange(status)}
          className={`px-3 py-1 rounded ${
            filter === status
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {status === 'all' ? t('seasons.filter.all') : t(`seasons.status.${status}`)}
        </button>
      ))}
    </div>
  );
}

export type { FilterValue };
