import {
  Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption,
} from 'frontend';

const rows = [
  { team: 'HC Sparta Praha', gp: 12, w: 9, l: 3, pts: 27 },
  { team: 'HC Kometa Brno', gp: 12, w: 8, l: 4, pts: 24 },
  { team: 'Bílí Tygři Liberec', gp: 12, w: 6, l: 6, pts: 18 },
  { team: 'HC Vítkovice', gp: 12, w: 4, l: 8, pts: 12 },
];

export function Standings() {
  return (
    <Table>
      <TableCaption>Group A — regular season standings</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Team</TableHead>
          <TableHead>GP</TableHead>
          <TableHead>W</TableHead>
          <TableHead>L</TableHead>
          <TableHead style={{ textAlign: 'right' }}>Pts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.team}>
            <TableCell style={{ fontWeight: 500 }}>{r.team}</TableCell>
            <TableCell>{r.gp}</TableCell>
            <TableCell>{r.w}</TableCell>
            <TableCell>{r.l}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.pts}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4}>Teams</TableCell>
          <TableCell style={{ textAlign: 'right' }}>4</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
