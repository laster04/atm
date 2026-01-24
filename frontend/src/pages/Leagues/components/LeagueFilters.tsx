import { useTranslation } from 'react-i18next';
import { Funnel } from "lucide-react";
import { SportType } from '@types';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from "@components/base/dropdown-menu";
import { Button } from "@components/base/button.tsx";

export type FilterValue = SportType | 'all';

interface LeagueFiltersProps {
	filter: FilterValue;
	onFilterChange: (filter: FilterValue) => void;
}

export default function LeagueFilters({ filter, onFilterChange }: LeagueFiltersProps) {
	const { t } = useTranslation();

	const sportTypes: FilterValue[] = ['all', ...Object.values(SportType)];

	return (
		<div className="flex gap-2 flex-wrap">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" className="flex items-center gap-2">
						<div className="sm:block text-left">
							<div
								className="text-sm font-medium">{filter === 'all' ? t('common.all') : t(`sports.${filter}`)}</div>
						</div>
						<Funnel/>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					{sportTypes.map((sportType) => (
						<DropdownMenuItem onClick={() => onFilterChange(sportType)}
										  className={`px-3 py-1.5 text-sm transition-colors ${
											  filter === sportType
												  ? 'bg-blue-600 text-white'
												  : 'hover:bg-gray-300'
										  }`}
						>
							{sportType === 'all' ? t('common.all') : t(`sports.${sportType}`)}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
