import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password,
      name: 'Admin User',
      role: 'ADMIN'
    }
  });

  const seasonManager = await prisma.user.upsert({
    where: { email: 'seasonmanager@example.com' },
    update: {},
    create: {
      email: 'seasonmanager@example.com',
      password,
      name: 'Season Manager',
      role: 'SEASON_MANAGER'
    }
  });

  const teamManager = await prisma.user.upsert({
    where: { email: 'teammanager@example.com' },
    update: {},
    create: {
      email: 'teammanager@example.com',
      password,
      name: 'Team Manager',
      role: 'TEAM_MANAGER'
    }
  });

  console.log('Created users:');
  console.log('- Admin:', admin.email);
  console.log('- Season Manager:', seasonManager.email);
  console.log('- Team Manager:', teamManager.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
