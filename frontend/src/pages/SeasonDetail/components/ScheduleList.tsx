import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/base/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/base/card";
import { FilterTimeEnum, GameSchedule } from "@/pages/SeasonDetail/components/GameSchedule.tsx";

import type { Game } from '@types';

interface ScheduleListProps {
  games: Game[];
}

export default function ScheduleList({ games }: ScheduleListProps) {
  const { t } = useTranslation();

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
      <Tabs defaultValue="today" className="space-y-6">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
          <TabsTrigger value="recent">{t('seasonDetail.schedule.recent')}</TabsTrigger>
          <TabsTrigger value="today">{t('seasonDetail.schedule.today')}</TabsTrigger>
          <TabsTrigger value="upcoming">{t('seasonDetail.schedule.upcoming')}</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Games</CardTitle>
              <CardDescription>Final scores from past</CardDescription>
            </CardHeader>
            <CardContent>
              <GameSchedule filter={FilterTimeEnum.RECENT} games={games} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="today">
          <Card>
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
              <CardDescription>Games scheduled for today</CardDescription>
            </CardHeader>
            <CardContent>
              <GameSchedule filter={FilterTimeEnum.TODAY} games={games} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Games</CardTitle>
              <CardDescription>Schedule for the next few days</CardDescription>
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
