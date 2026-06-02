import { prisma } from './db/prisma';

async function main() {
  const policies: any = await prisma.$queryRaw`
    SELECT schemaname::text, tablename::text, policyname::text, cmd::text, qual::text, with_check::text 
    FROM pg_policies
    WHERE schemaname = 'public';
  `;
  console.log('RLS Policies:');
  console.log(JSON.stringify(policies, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
