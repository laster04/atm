import { PrismaClient } from '@prisma/client';

// A team's chat link lets whoever holds it join the group, and team rows are
// returned whole by many public endpoints. Omitting it here means it only
// leaves the database where a query asks for it by name.
const prisma = new PrismaClient({
  omit: { team: { chatUrl: true } },
});

export default prisma;

/** The client or a transaction opened on it, for helpers that accept either. */
export type DbClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
