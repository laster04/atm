import { Tabs, TabsList, TabsTrigger, TabsContent } from 'frontend';

export function SeasonTabs() {
  return (
    <Tabs defaultValue="standings" style={{ width: 380 }}>
      <TabsList>
        <TabsTrigger value="standings">Standings</TabsTrigger>
        <TabsTrigger value="schedule">Schedule</TabsTrigger>
        <TabsTrigger value="scorers">Top scorers</TabsTrigger>
      </TabsList>
      <TabsContent value="standings" style={{ paddingTop: 12, fontSize: 14 }}>
        HC Sparta Praha leads Group A with 27 points after 12 games.
      </TabsContent>
      <TabsContent value="schedule" style={{ paddingTop: 12, fontSize: 14 }}>
        Next match: Sparta vs Kometa, April 20.
      </TabsContent>
      <TabsContent value="scorers" style={{ paddingTop: 12, fontSize: 14 }}>
        J. Novák — 14 goals, 9 assists.
      </TabsContent>
    </Tabs>
  );
}
