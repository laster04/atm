import { Label } from 'frontend';
import { Input } from 'frontend';

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, width: 280 };

export function WithInput() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={field}>
        <Label htmlFor="team">Team name</Label>
        <Input id="team" defaultValue="HC Sparta Praha" />
      </div>
      <div style={field}>
        <Label htmlFor="email">Manager email</Label>
        <Input id="email" type="email" placeholder="manager@club.cz" />
      </div>
    </div>
  );
}
