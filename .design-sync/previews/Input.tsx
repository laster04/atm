import { Input } from 'frontend';

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, width: 280 };

export function Types() {
  return (
    <div style={col}>
      <Input placeholder="Team name" defaultValue="HC Sparta Praha" />
      <Input type="email" placeholder="manager@club.cz" />
      <Input type="number" placeholder="Jersey number" defaultValue={17} />
      <Input type="date" defaultValue="2026-04-20" />
    </div>
  );
}

export function States() {
  return (
    <div style={col}>
      <Input placeholder="Empty" />
      <Input defaultValue="Filled value" />
      <Input defaultValue="Disabled" disabled />
      <Input aria-invalid placeholder="Invalid input" />
    </div>
  );
}
