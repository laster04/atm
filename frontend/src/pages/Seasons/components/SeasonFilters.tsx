import { useTranslation } from 'react-i18next';
import { SeasonStatus } from '@types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@components/base/dropdown-menu.tsx";
import { Button } from "@components/base/button.tsx";
import { Funnel } from "lucide-react";
import { useAuth } from '@/context/AuthContext.tsx';

type FilterValue = 'all' | SeasonStatus;

interface SeasonFiltersProps {
  filter: FilterValue;
  onFilterChange: (filter: FilterValue) => void;
}

export default function SeasonFilters({ filter, onFilterChange }: SeasonFiltersProps) {
  const { isAdmin, isSeasonManager } = useAuth();
  const { t } = useTranslation();

  const filters: FilterValue[] = ['all', SeasonStatus.ACTIVE, SeasonStatus.COMPLETED];
  if (isAdmin() || isSeasonManager()) {
    filters.push(SeasonStatus.DRAFT);
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <div className="sm:block text-left">
              <div
                  className="text-sm font-medium">{filter === 'all' ? t('seasons.filter.all') : t(`seasons.status.${filter}`)}</div>
            </div>
            <Funnel/>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {filters.map((status) => (
              <DropdownMenuItem onClick={() => onFilterChange(status)}
                                className={`px-3 py-1.5 text-sm transition-colors ${
                                    filter === status
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-gray-300'
                                }`}
              >
                {status === 'all' ? t('seasons.filter.all') : t(`seasons.status.${status}`)}
              </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export type { FilterValue };
