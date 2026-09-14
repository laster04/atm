import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { Game } from '@types';
import { EmptyState, FilterTabs, Panel, type FilterTab } from '@/components/public';
import { TabSeasonDetailType } from '../Screen';
import { FilterTimeEnum, GameSchedule } from './GameSchedule';

export default function ScheduleList({ games }: { games: Game[] }) {
	const { t } = useTranslation();
	const [searchParams, setSearchParams] = useSearchParams();
	const active = (searchParams.get('scheduleType') as FilterTimeEnum) || FilterTimeEnum.UPCOMING;

	const setActive = (scheduleType: FilterTimeEnum) => {
		setSearchParams({ tab: TabSeasonDetailType.SCHEDULE, scheduleType }, { replace: true });
	};

	if (games.length === 0) {
		return <EmptyState title={t('seasonDetail.schedule.noGames')} />;
	}

	const tabs: FilterTab<FilterTimeEnum>[] = [
		{ value: FilterTimeEnum.UPCOMING, label: t('seasonDetail.schedule.upcoming') },
		{ value: FilterTimeEnum.TODAY, label: t('seasonDetail.schedule.today') },
		{ value: FilterTimeEnum.RECENT, label: t('seasonDetail.schedule.recent') },
	];

	const titles: Record<FilterTimeEnum, string> = {
		[FilterTimeEnum.UPCOMING]: t('seasonDetail.schedule.upcomingGames'),
		[FilterTimeEnum.TODAY]: t('seasonDetail.schedule.todaysSchedule'),
		[FilterTimeEnum.RECENT]: t('seasonDetail.schedule.recentGames'),
	};

	const descriptions: Record<FilterTimeEnum, string> = {
		[FilterTimeEnum.UPCOMING]: t('seasonDetail.schedule.upcomingGamesDescription'),
		[FilterTimeEnum.TODAY]: t('seasonDetail.schedule.todaysGamesDescription'),
		[FilterTimeEnum.RECENT]: t('seasonDetail.schedule.recentGamesDescription'),
	};

	return (
		<div className="flex flex-col gap-5">
			<FilterTabs tabs={tabs} value={active} onChange={setActive} className="self-start" />
			<Panel flush title={titles[active]} description={descriptions[active]}>
				<GameSchedule filter={active} games={games} />
			</Panel>
		</div>
	);
}
