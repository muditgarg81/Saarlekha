import { prisma } from '../db/prisma';

async function main() {
  console.log("=== Querying Companies ===");
  const companies = await prisma.company.findMany();
  console.log(`Found ${companies.length} companies.`);

  for (const c of companies) {
    console.log(`\n--- Company: ${c.name} (ID: ${c.id}) ---`);
    
    // Set RLS config transactionally
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${c.id}', true)`);
      
      const logs = await tx.auditLogEntry.findMany({
        orderBy: { timestamp: 'desc' },
        take: 30,
        include: { user: { select: { email: true } } }
      });
      
      console.log(`Found ${logs.length} audit logs:`);
      for (const l of logs) {
        console.log(`[${l.timestamp.toISOString()}] User: ${l.user.email}`);
        console.log(`  Action: ${l.action}`);
        console.log(`  Entity: ${l.entity_type} (ID: ${l.entity_id})`);
        console.log(`  Details:`, JSON.stringify(l.details));
      }
    });
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
