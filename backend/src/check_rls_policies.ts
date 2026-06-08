import { prisma } from './db/prisma';

async function main() {
  const policies = await prisma.$queryRawUnsafe(`
    SELECT policyname, cmd, qual 
    FROM pg_policies 
    WHERE tablename = 'Token';
  `);
  
  console.log('--- RLS Policies for Token Table ---');
  console.log(JSON.stringify(policies, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
