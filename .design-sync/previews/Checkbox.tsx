import { Checkbox } from 'frontend';
import { Label } from 'frontend';

const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };

export function States() {
  return (
    <div style={col}>
      <div style={item}>
        <Checkbox id="c1" defaultChecked />
        <Label htmlFor="c1">Notify players by email</Label>
      </div>
      <div style={item}>
        <Checkbox id="c2" />
        <Label htmlFor="c2">Publish schedule automatically</Label>
      </div>
      <div style={item}>
        <Checkbox id="c3" disabled />
        <Label htmlFor="c3">Locked (season completed)</Label>
      </div>
    </div>
  );
}
