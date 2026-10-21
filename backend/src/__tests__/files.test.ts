import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import app from '../app.js';
import prisma from '../config/database.js';
import { deleteUnreferencedLogos } from '../services/storage/files.js';

const stamp = Date.now();
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-files-'));
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.STORAGE_PUBLIC_URL = '/api/uploads';

let adminToken: string;
let managerToken: string;
let strangerToken: string;
let seasonId: string;
let teamId: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function account(label: string, role: 'ADMIN' | 'USER' = 'USER') {
  const email = `${label}-${stamp}@test.com`;
  const user = await prisma.user.create({
    data: { email, password: await bcrypt.hash('password123', 10), name: label, role, active: true, emailVerified: true },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, token: res.body.token as string };
}

const image = (format: 'png' | 'jpeg' | 'gif', width = 1200, height = 800) => {
  const base = sharp({ create: { width, height, channels: 3, background: '#1d4ed8' } });
  if (format === 'jpeg') return base.jpeg().withExif({ IFD0: { Copyright: 'secret owner' } }).toBuffer();
  return format === 'png' ? base.png().toBuffer() : base.gif().toBuffer();
};

const upload = (token: string, body: Buffer, filename = 'logo.png') =>
  request(app).post('/api/files/logo').set(auth(token)).attach('file', body, filename);

/** Uploads a fresh logo and returns its URL. */
const uploaded = async (token = adminToken): Promise<string> => {
  const res = await upload(token, await image('png', 64, 64));
  expect(res.status).toBe(201);
  return res.body.url as string;
};

const onDisk = (url: string) => path.join(storageDir, 'public', url.replace('/api/uploads/', ''));

beforeAll(async () => {
  ({ token: adminToken } = await account('admin-files', 'ADMIN'));
  const manager = await account('manager-files');
  managerToken = manager.token;
  ({ token: strangerToken } = await account('stranger-files'));

  const league = await request(app).post('/api/leagues').set(auth(adminToken))
    .send({ name: `Files League ${stamp}`, sportType: 'HOCKEY' });
  const season = await request(app).post('/api/seasons').set(auth(adminToken))
    .send({ name: `Files Season ${stamp}`, leagueId: league.body.id, startDate: '2026-01-01', endDate: '2027-12-31' });
  seasonId = season.body.id;
  const team = await request(app).post(`/api/teams/season/${seasonId}`).set(auth(adminToken))
    .send({ name: `Files Team ${stamp}` });
  teamId = team.body.id;
  await prisma.team.update({ where: { id: teamId }, data: { managerId: manager.id } });
});

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(storageDir, { recursive: true, force: true });
});

describe('uploading a logo', () => {
  it('stores it as a WebP of at most 512 px, without EXIF', async () => {
    const res = await upload(managerToken, await image('jpeg'), 'photo.jpg');
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/api\/uploads\/logos\/[0-9a-f-]+\.webp$/);

    const meta = await sharp(fs.readFileSync(onDisk(res.body.url))).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width!, meta.height!)).toBe(512);
    expect(meta.exif).toBeUndefined();

    const row = await prisma.storedFile.findUnique({ where: { url: res.body.url } });
    expect(row).toMatchObject({ kind: 'LOGO', visibility: 'PUBLIC', ownerType: null, mimeType: 'image/webp' });
  });

  it('is served back as an image that cannot be sniffed as anything else', async () => {
    const url = await uploaded();
    const res = await request(app).get(url);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect((await request(app).get('/api/uploads/logos/missing.webp')).status).toBe(404);
  });

  it('refuses SVG, GIF and files that only pretend to be images', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    for (const [body, name] of [
      [svg, 'logo.svg'],
      [await image('gif', 32, 32), 'logo.gif'],
      [Buffer.from('definitely not a png'), 'logo.png'],
    ] as const) {
      const res = await upload(managerToken, body, name);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FILE_TYPE_NOT_ALLOWED');
    }
  });

  it('refuses files over 1 MB', async () => {
    const res = await upload(managerToken, Buffer.alloc(1024 * 1024 + 1, 1));
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  it('needs a signed-in user', async () => {
    const res = await request(app).post('/api/files/logo').attach('file', await image('png', 16, 16), 'logo.png');
    expect(res.status).toBe(401);
  });
});

describe('saving an uploaded logo', () => {
  it('attaches it to the team that saved it', async () => {
    const url = await uploaded(managerToken);
    const res = await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken)).send({ logo: url });
    expect(res.status).toBe(200);
    expect(res.body.logo).toBe(url);
    const row = await prisma.storedFile.findUnique({ where: { url } });
    expect(row).toMatchObject({ ownerType: 'TEAM', ownerId: teamId });
  });

  it('is refused on a team the user does not run', async () => {
    const before = await prisma.team.findUnique({ where: { id: teamId }, select: { logo: true } });
    const url = await uploaded(strangerToken);
    const res = await request(app).put(`/api/teams/${teamId}`).set(auth(strangerToken)).send({ logo: url });
    expect(res.status).toBe(403);
    const after = await prisma.team.findUnique({ where: { id: teamId }, select: { logo: true } });
    expect(after!.logo).toBe(before!.logo);
  });

  it('deletes the logo it replaces', async () => {
    const first = await uploaded(managerToken);
    await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken)).send({ logo: first });
    const second = await uploaded(managerToken);
    await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken)).send({ logo: second });

    expect(await prisma.storedFile.findUnique({ where: { url: first } })).toBeNull();
    expect(fs.existsSync(onDisk(first))).toBe(false);
    expect(fs.existsSync(onDisk(second))).toBe(true);
  });

  it('deletes the logo when it is cleared', async () => {
    const url = await uploaded(managerToken);
    await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken)).send({ logo: url });
    const res = await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken)).send({ logo: null });
    expect(res.body.logo).toBeNull();
    expect(await prisma.storedFile.findUnique({ where: { url } })).toBeNull();
  });

  it('drops a URL that looks like ours but was never uploaded', async () => {
    const res = await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken))
      .send({ logo: '/api/uploads/logos/never-uploaded.webp' });
    expect(res.body.logo).toBeNull();
  });

  it('works the same for leagues, series and tournament teams', async () => {
    const leagueLogo = await uploaded();
    const league = await request(app).post('/api/leagues').set(auth(adminToken))
      .send({ name: `Logo League ${stamp}`, sportType: 'FLOORBALL', logo: leagueLogo });
    expect(league.body.logo).toBe(leagueLogo);

    const seriesLogo = await uploaded();
    const series = await request(app).post('/api/tournaments/series').set(auth(adminToken))
      .send({ name: `Logo Cup ${stamp}`, sportType: 'FLOORBALL', logo: seriesLogo });
    expect(series.body.logo).toBe(seriesLogo);

    const tournament = await request(app).post(`/api/tournaments/series/${series.body.id}/tournaments`)
      .set(auth(adminToken)).send({ name: `Logo Cup ${stamp} 2026` });
    const teamLogo = await uploaded();
    const team = await request(app).post(`/api/tournaments/${tournament.body.id}/teams`).set(auth(adminToken))
      .send({ name: 'Logo Guests', logo: teamLogo });
    expect(team.body.logo).toBe(teamLogo);

    const owners = await prisma.storedFile.findMany({
      where: { url: { in: [leagueLogo, seriesLogo, teamLogo] } }, select: { ownerType: true },
    });
    expect(owners.map((o) => o.ownerType).sort()).toEqual(['LEAGUE', 'TOURNAMENT_SERIES', 'TOURNAMENT_TEAM']);

    // Deleting the series takes the files of everything under it.
    const del = await request(app).delete(`/api/tournaments/series/${series.body.id}`).set(auth(adminToken));
    expect(del.status).toBe(200);
    expect(await prisma.storedFile.count({ where: { url: { in: [seriesLogo, teamLogo] } } })).toBe(0);
    expect(fs.existsSync(onDisk(teamLogo))).toBe(false);

    await request(app).delete(`/api/leagues/${league.body.id}`).set(auth(adminToken));
    expect(await prisma.storedFile.count({ where: { url: leagueLogo } })).toBe(0);
  });
});

describe('external logo links', () => {
  it('are cleared when they cannot be fetched', async () => {
    const res = await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken))
      .send({ logo: 'https://127.0.0.1/logo.png' });
    expect(res.status).toBe(200);
    expect(res.body.logo).toBeNull();
  });

  it('left from before uploads are converted on any save of the record', async () => {
    await prisma.team.update({ where: { id: teamId }, data: { logo: 'https://10.0.0.5/old-logo.png' } });
    const res = await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken)).send({ primaryColor: '#123456' });
    expect(res.status).toBe(200);
    expect(res.body.logo).toBeNull();
    expect(res.body.primaryColor).toBe('#123456');
  });
});

describe('cleanup', () => {
  it('keeps a deleted team\'s logo while an archived season still shows it', async () => {
    const team = await request(app).post(`/api/teams/season/${seasonId}`).set(auth(adminToken))
      .send({ name: `Archived Team ${stamp}`, logo: await uploaded() });
    const url = team.body.logo as string;
    const standing = await prisma.seasonArchiveStanding.create({
      data: {
        seasonId, teamId: team.body.id, teamName: team.body.name, teamLogo: url,
        rank: 1, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
      },
    });

    await request(app).delete(`/api/teams/${team.body.id}`).set(auth(adminToken)).expect(200);
    expect(await prisma.storedFile.findUnique({ where: { url } })).not.toBeNull();

    await prisma.seasonArchiveStanding.delete({ where: { id: standing.id } });
    await deleteUnreferencedLogos({ createdBefore: new Date(Date.now() + 1000) });
    expect(await prisma.storedFile.findUnique({ where: { url } })).toBeNull();
    expect(fs.existsSync(onDisk(url))).toBe(false);
  });

  it('sweeps uploads that were never saved and keeps the ones in use', async () => {
    const unused = await uploaded();
    const used = await uploaded(managerToken);
    await request(app).put(`/api/teams/${teamId}`).set(auth(managerToken)).send({ logo: used });

    await deleteUnreferencedLogos({ createdBefore: new Date(Date.now() + 1000) });
    expect(await prisma.storedFile.findUnique({ where: { url: unused } })).toBeNull();
    expect(await prisma.storedFile.findUnique({ where: { url: used } })).not.toBeNull();
  });
});
