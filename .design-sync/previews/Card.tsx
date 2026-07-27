import {
  Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter,
} from 'frontend';
import { Button } from 'frontend';
import { Badge } from 'frontend';

export function TeamCard() {
  return (
    <Card style={{ width: 340 }}>
      <CardHeader>
        <CardTitle>HC Sparta Praha</CardTitle>
        <CardDescription>Group A · Ice Hockey</CardDescription>
        <CardAction>
          <Badge variant="secondary">1st</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>Played 12 · Won 9 · Lost 3</span>
          <strong>27 pts</strong>
        </div>
      </CardContent>
      <CardFooter style={{ display: 'flex', gap: 8 }}>
        <Button size="sm">View squad</Button>
        <Button size="sm" variant="outline">Schedule</Button>
      </CardFooter>
    </Card>
  );
}

export function TournamentCard() {
  return (
    <Card style={{ width: 340 }}>
      <CardHeader>
        <CardTitle>Spring Cup 2026</CardTitle>
        <CardDescription>16 teams · Group stage in progress</CardDescription>
      </CardHeader>
      <CardContent style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
        Round 4 of 7 completed. Playoffs begin April 20.
      </CardContent>
    </Card>
  );
}
