import { prisma } from './db/prisma';

async function main() {
  const policies = await prisma.$queryRawUnsafe(`
    SELECT policyname, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'AuditLogEntry';
  `);
  
  console.log('--- RLS Policies for AuditLogEntry Table ---');
  console.log(JSON.stringify(policies, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
