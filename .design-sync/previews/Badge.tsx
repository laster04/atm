import { Badge } from 'frontend';

const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' };

export function Variants() {
  return (
    <div style={row}>
      <Badge>Active</Badge>
      <Badge variant="secondary">Group stage</Badge>
      <Badge variant="outline">Draft</Badge>
      <Badge variant="destructive">Cancelled</Badge>
    </div>
  );
}

export function StatusLabels() {
  return (
    <div style={row}>
      <Badge variant="secondary">Ice Hockey</Badge>
      <Badge variant="outline">Forward</Badge>
      <Badge>1st place</Badge>
    </div>
  );
}
