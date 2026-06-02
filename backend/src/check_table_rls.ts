import { prisma } from './db/prisma';

async function main() {
  const tableRLS: any = await prisma.$queryRaw`
    SELECT relname::text, relrowsecurity::boolean, relforcerowsecurity::boolean 
    FROM pg_class 
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = 'public' AND relkind = 'r';
  `;
  console.log('Table RLS Status:');
  console.log(JSON.stringify(tableRLS, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
