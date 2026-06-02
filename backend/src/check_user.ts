import { prisma } from './db/prisma';

async function main() {
  const users = await prisma.user.findMany();
  console.log('Database Users:', users.map(u => ({ id: u.id, email: u.email, role: u.role })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
