import { prisma } from '../db/prisma';

async function main() {
  console.log("=== Checking Audit Logs ===");
  // Query all audit logs without tenant restriction by querying the DB
  // Audit logs don't have RLS or we bypass by running query within all tenant contexts
  const companies = await prisma.company.findMany();
  for (const c of companies) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${c.id}', true)`);
      const logs = await tx.auditLogEntry.findMany({
        orderBy: { timestamp: 'desc' }
      });
      console.log(`\nCompany: ${c.name} (${c.id})`);
      for (const log of logs) {
        const detailsStr = log.details ? JSON.stringify(log.details) : '';
        if (detailsStr.includes('6418d95e-576e-4cff-9021-f55f23a56004') || log.entity_id === '6418d95e-576e-4cff-9021-f55f23a56004') {
          console.log(`- Log: ${log.timestamp.toISOString()} | Action: ${log.action} | Entity: ${log.entity_type} (${log.entity_id}) | Details: ${detailsStr}`);
        }
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
