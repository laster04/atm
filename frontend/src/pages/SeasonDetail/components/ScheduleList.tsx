import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/base/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/base/card";
import { FilterTimeEnum, GameSchedule } from "@/pages/SeasonDetail/components/GameSchedule.tsx";

import type { Game } from '@types';
import { TabSeasonDetailType } from "@/pages/SeasonDetail/Screen.tsx";

interface ScheduleListProps {
  games: Game[];
}

enum TabScheduleType {
  RECENT = 'recent',
  TODAY = 'today',
  UPCOMING = 'upcoming'
}

export default function ScheduleList({ games }: ScheduleListProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('scheduleType') || TabScheduleType.TODAY;

  const setActiveScheduleTab = (scheduleType: string) => {
    setSearchParams({ tab: TabSeasonDetailType.SCHEDULE, scheduleType }, { replace: true });
  };

  if (games.length === 0) {
    return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">{t('seasonDetail.schedule.noGames')}</p>
          </CardContent>
        </Card>
    );
  }

  return (
      <>
      <Tabs defaultValue={activeTab} onValueChange={setActiveScheduleTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
          <TabsTrigger value={TabScheduleType.RECENT}>{t('seasonDetail.schedule.recent')}</TabsTrigger>
          <TabsTrigger value={TabScheduleType.TODAY}>{t('seasonDetail.schedule.today')}</TabsTrigger>
          <TabsTrigger value={TabScheduleType.UPCOMING}>{t('seasonDetail.schedule.upcoming')}</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>{t('seasonDetail.schedule.recentGames')}</CardTitle>
              <CardDescription>{t('seasonDetail.schedule.recentGamesDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <GameSchedule filter={FilterTimeEnum.RECENT} games={games} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="today">
          <Card>
            <CardHeader>
              <CardTitle>{t('seasonDetail.schedule.todaysSchedule')}</CardTitle>
              <CardDescription>{t('seasonDetail.schedule.todaysGamesDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <GameSchedule filter={FilterTimeEnum.TODAY} games={games} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle>{t('seasonDetail.schedule.upcomingGames')}</CardTitle>
              <CardDescription>{t('seasonDetail.schedule.upcomingGamesDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <GameSchedule filter={FilterTimeEnum.UPCOMING} games={games} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </>
  );
}
