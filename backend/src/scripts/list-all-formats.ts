import { prisma } from '../db/prisma';

async function main() {
  const companies = await prisma.company.findMany();
  for (const c of companies) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${c.id}', true)`);
      const formats = await tx.reportFormat.findMany({
        include: {
          versions: {
            orderBy: { version_num: 'desc' }
          }
        }
      });
      console.log(`\nCompany: ${c.name} (${c.id})`);
      for (const f of formats) {
        console.log(`- Format: ${f.name} (Type: ${f.type}, ID: ${f.id})`);
        console.log(`  Versions: ${f.versions.map(v => `${v.version_num} (ID: ${v.id}, Schema len: ${v.fields_schema ? JSON.stringify(v.fields_schema).length : 0})`).join(', ')}`);
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
