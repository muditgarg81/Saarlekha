import { prisma } from './db/prisma';

async function main() {
  const token = await prisma.token.findFirst({
    where: {
      token: {
        startsWith: 'a4996401'
      }
    }
  });

  if (!token) {
    console.log('Token not found.');
    return;
  }

  console.log('RAW TOKEN:', token);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
