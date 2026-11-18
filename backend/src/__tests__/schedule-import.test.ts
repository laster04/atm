import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import prisma from '../config/database.js';
import { readSpreadsheet } from '../services/imports/spreadsheet.js';
import { parseFixtures } from '../services/imports/scheduleImport.js';

const stamp = Date.now();
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });

async function account(label: string) {
  const email = `${label}-imp-${stamp}@test.com`;
  await prisma.user.create({ data: { email, password: await bcrypt.hash('password123', 10), name: label, active: true, emailVerified: true } });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return res.body.token as string;
}

/** A minimal XLSX (stored, uncompressed entries), shaped like the ČVS "Program" export. */
function xlsx(rows: (string | number | null)[][]): Buffer {
  const strings: string[] = [];
  const index = (value: string) => {
    const at = strings.indexOf(value);
    return at >= 0 ? at : strings.push(value) - 1;
  };
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const column = (i: number) => String.fromCharCode(65 + i);
  const sheetRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
    if (cell === null) return '';
    const ref = `${column(c)}${r + 1}`;
    return typeof cell === 'number' ? `<c r="${ref}"><v>${cell}</v></c>` : `<c r="${ref}" t="s"><v>${index(cell)}</v></c>`;
  }).join('')}</row>`).join('');
  const files: Record<string, string> = {
    'xl/workbook.xml': '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Program" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst>${strings.map((s) => `<si><t>${escape(s)}</t></si>`).join('')}</sst>`,
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  // sharedStrings is filled while the sheet is written, so build the sheet first.
  files['xl/sharedStrings.xml'] = `<sst>${strings.map((s) => `<si><t>${escape(s)}</t></si>`).join('')}</sst>`;
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8');
    const nameBytes = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

const HEADER = ['Datum', 'Čas', 'Kolo', 'Skupina', 'Domácí', 'Hosté', 'Hala', 'Poznámka'];
// 46349.8125 = Monday 23 Nov 2026 19:30 (Prague, so 18:30 UTC).
const program = (extra: (string | number | null)[][] = []) => xlsx([
  HEADER,
  [46349.8125, 46349.8125, 4, 'Přebor', 'Volejbal Alfa', 'TJ Beta', 'Hala A', null],
  [46351.79166666666, 46351.79166666666, 5, 'Přebor', 'TJ Beta', 'SK Gama', 'Hala B', null],
  [46352.84027777778, 46352.84027777778, 5, 'Přebor', 'SK Gama', 'Volejbal Alfa', null, null],
  ...extra,
]);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('reading the file', () => {
  it('reads the ČVS program export: serial dates as Prague times, rounds, venues', () => {
    const fixtures = parseFixtures(readSpreadsheet(program()));
    expect(fixtures).toHaveLength(3);
    expect(fixtures[0]).toMatchObject({ line: 2, round: 4, home: 'Volejbal Alfa', away: 'TJ Beta', location: 'Hala A', problem: null });
    expect(fixtures[0].date?.toISOString()).toBe('2026-11-23T18:30:00.000Z');
    expect(fixtures[1].date?.toISOString()).toBe('2026-11-25T18:00:00.000Z');
    expect(fixtures[2].date?.toISOString()).toBe('2026-11-26T19:10:00.000Z');
  });

  it('reads a CSV with Czech dates, and flags rows it cannot import', () => {
    const csv = [
      'Kolo;Datum;Čas;Domácí;Hosté;Místo',
      '1;18.11.2026;20:20;A;B;Hala',
      '1;18.11.2026;20:20;A;B;Hala',
      '2;19. 11. 2026;19.00;C;C;Hala',
      '3;32.13.2026;;A;C;',
      '4;;;B;;',
    ].join('\r\n');
    const fixtures = parseFixtures(readSpreadsheet(Buffer.from(csv, 'utf8')));
    expect(fixtures.map((f) => f.problem)).toEqual([null, 'DUPLICATE', 'SAME_TEAM', 'BAD_DATE', 'NO_TEAMS']);
    expect(fixtures[0].date?.toISOString()).toBe('2026-11-18T19:20:00.000Z');
  });

  it('reads a CSV saved as Windows-1250 by Czech Excel', () => {
    // "Domácí;Hosté\r\nŽďár;Třebín" in Windows-1250 bytes.
    const cp1250: Record<string, number> = { á: 0xe1, í: 0xed, é: 0xe9, Ž: 0x8e, ď: 0xef, ř: 0xf8 };
    const bytes = Buffer.from([...'Domácí;Hosté\r\nŽďár;Třebín'].map((char) => cp1250[char] ?? char.charCodeAt(0)));
    const fixtures = parseFixtures(readSpreadsheet(bytes));
    expect(fixtures[0]).toMatchObject({ home: 'Žďár', away: 'Třebín' });
  });

  it('refuses a file without home and away columns', () => {
    expect(() => parseFixtures(readSpreadsheet(Buffer.from('Datum;Tým\n1.1.2027;A', 'utf8')))).toThrow('lacks the columns');
  });
});

describe('importing into a season', () => {
  let owner: string;
  let stranger: string;
  let seasonId: string;

  beforeAll(async () => {
    owner = await account('owner');
    stranger = await account('stranger');
    const league = await request(app).post('/api/leagues').set(auth(owner)).send({ name: `Import ${stamp}`, sportType: 'VOLLEYBALL' });
    const season = await request(app).post('/api/seasons').set(auth(owner))
      .send({ name: '2026/27', leagueId: league.body.id, startDate: '2026-09-01', endDate: '2027-05-31' });
    seasonId = season.body.id;
    // A team already in the season, written a little differently.
    await request(app).post(`/api/teams/season/${seasonId}`).set(auth(owner)).send({ name: 'tj beta' });
  });

  const send = (path: string, file: Buffer, token = owner, name = 'program.xlsx') =>
    request(app).post(`/api/seasons/${seasonId}/${path}`).set(auth(token)).attach('file', file, name);

  it('previews without changing anything, and only for the season manager', async () => {
    expect((await send('schedule-import/preview', program(), stranger)).status).toBe(403);
    const res = await send('schedule-import/preview', program());
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ create: 3, update: 0, unchanged: 0, skip: 0, newTeams: 2 });
    expect(res.body.teams).toEqual([
      { name: 'SK Gama', existing: false, games: 2 },
      { name: 'tj beta', existing: true, games: 2 },
      { name: 'Volejbal Alfa', existing: false, games: 2 },
    ]);
    expect(await prisma.game.count({ where: { seasonId } })).toBe(0);
  });

  it('imports teams and games, then moves what an updated program moved', async () => {
    const res = await send('schedule-import', program());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ create: 3, newTeams: 2 });
    const games = await prisma.game.findMany({ where: { seasonId }, include: { homeTeam: true, awayTeam: true }, orderBy: { date: 'asc' } });
    expect(games.map((g) => `${g.round} ${g.homeTeam.name}-${g.awayTeam.name}`)).toEqual(['4 Volejbal Alfa-tj beta', '5 tj beta-SK Gama', '5 SK Gama-Volejbal Alfa']);
    expect(await prisma.seasonTeam.count({ where: { seasonId } })).toBe(3);

    // Round 4 is played; the program moves it and round 5's first game.
    await prisma.game.update({ where: { id: games[0].id }, data: { status: 'COMPLETED', homeScore: 3, awayScore: 1 } });
    const moved = xlsx([
      HEADER,
      [46350.8125, null, 4, 'Přebor', 'Volejbal Alfa', 'TJ Beta', 'Hala A', null],
      [46360.75, null, 5, 'Přebor', 'TJ Beta', 'SK Gama', 'Hala C', null],
      [46352.84027777778, 46352.84027777778, 5, 'Přebor', 'SK Gama', 'Volejbal Alfa', null, null],
    ]);
    const preview = await send('schedule-import/preview', moved);
    expect(preview.body.counts).toEqual({ create: 0, update: 1, unchanged: 1, skip: 1, newTeams: 0 });
    expect(preview.body.fixtures[0]).toMatchObject({ action: 'SKIP', problem: 'PLAYED' });
    expect(preview.body.fixtures[1]).toMatchObject({ action: 'UPDATE', changes: ['date', 'location'] });

    await send('schedule-import', moved);
    const after = await prisma.game.findUniqueOrThrow({ where: { id: games[1].id } });
    expect(after.date?.toISOString()).toBe('2026-12-04T17:00:00.000Z');
    expect(after.location).toBe('Hala C');
    expect((await prisma.game.findUniqueOrThrow({ where: { id: games[0].id } })).date?.toISOString()).toBe(games[0].date?.toISOString());
    expect(await prisma.auditLog.count({ where: { entityType: 'Season', entityId: seasonId } })).toBe(2);
  });

  it('explains a file it cannot use', async () => {
    const missing = await send('schedule-import/preview', Buffer.from('Datum;Tým\n1.1.2027;A', 'utf8'), owner, 'a.csv');
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('MISSING_COLUMNS');
    const noFile = await request(app).post(`/api/seasons/${seasonId}/schedule-import/preview`).set(auth(owner));
    expect(noFile.body.code).toBe('FILE_MISSING');
    await prisma.season.update({ where: { id: seasonId }, data: { archivedAt: new Date() } });
    expect((await send('schedule-import/preview', program())).body.code).toBe('ARCHIVED');
  });
});
