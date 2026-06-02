import { prisma } from '../db/prisma';

async function main() {
  console.log("=== Starting Duplicate Format Cleanup ===");
  const companies = await prisma.company.findMany();
  
  for (const c of companies) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${c.id}', true)`);
      
      const formats = await tx.reportFormat.findMany({
        where: {
          type: { in: ['JOB_ORDER', 'MAINTENANCE'] }
        },
        include: {
          versions: {
            orderBy: { version_num: 'desc' }
          }
        }
      });

      // Group formats by type
      const groups: Record<string, typeof formats> = {};
      for (const f of formats) {
        if (!groups[f.type]) groups[f.type] = [];
        groups[f.type].push(f);
      }

      for (const type of Object.keys(groups)) {
        const typeFormats = groups[type];
        if (typeFormats.length <= 1) continue;

        console.log(`Company ${c.name} (${c.id}) has ${typeFormats.length} duplicate formats of type: ${type}`);
        
        // Find the best format to keep:
        // 1. Has non-empty fields schema in latest version
        // 2. Has the most versions
        // 3. Fallback: first created
        let bestFormat = typeFormats[0];
        let bestScore = -1;

        for (const f of typeFormats) {
          let score = 0;
          const latestVersion = f.versions[0];
          if (latestVersion && Array.isArray(latestVersion.fields_schema) && latestVersion.fields_schema.length > 0) {
            score += 1000 + latestVersion.fields_schema.length;
          }
          score += f.versions.length;
          
          if (score > bestScore) {
            bestScore = score;
            bestFormat = f;
          }
        }

        console.log(`  Keeping format: ${bestFormat.name} (ID: ${bestFormat.id}) with score ${bestScore}`);

        // Delete other duplicate formats and their versions
        for (const f of typeFormats) {
          if (f.id === bestFormat.id) continue;
          
          console.log(`  Deleting duplicate format: ${f.name} (ID: ${f.id})`);
          // Delete versions first
          await tx.reportFormatVersion.deleteMany({
            where: { format_id: f.id }
          });
          // Delete format
          await tx.reportFormat.delete({
            where: { id: f.id }
          });
        }
      }
    });
  }
  console.log("=== Duplicate Format Cleanup Complete ===");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
