/**
 * Deletes stored logos nothing references, once. The server does the same
 * every six hours (src/jobs/fileSweep.ts); this is for running it by hand.
 *
 *   npm run files:sweep
 */
import 'dotenv/config';
import prisma from '../src/config/database.js';
import { sweepFiles } from '../src/jobs/fileSweep.js';

const deleted = await sweepFiles();
console.log(`Deleted ${deleted} unreferenced file(s).`);
await prisma.$disconnect();
