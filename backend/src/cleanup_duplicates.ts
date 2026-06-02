import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('--- Scanning and Cleaning Up Duplicate Formats (Fixed Split Bug) ---');

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('DATABASE_URL is not set in environment.');
  }

  const pool = new pg.Pool({ connectionString: rawUrl });
  const adapter = new PrismaPg(pool);
  const sysPrisma = new PrismaClient({ adapter });

  try {
    const allFormats = await sysPrisma.reportFormat.findMany({
      include: {
        versions: {
          orderBy: { version_num: 'desc' }
        }
      }
    });

    console.log(`Found ${allFormats.length} total Report Formats in the database.`);

    // Group formats by company and type using '|' as delimiter to avoid split bugs with 'JOB_ORDER'
    const groupings: Record<string, typeof allFormats> = {};
    for (const f of allFormats) {
      const key = `${f.company_id}|${f.type}`;
      if (!groupings[key]) groupings[key] = [];
      groupings[key].push(f);
    }

    for (const [key, formats] of Object.entries(groupings)) {
      const [companyId, type] = key.split('|');
      if (type !== 'JOB_ORDER' && type !== 'MAINTENANCE') continue;

      if (formats.length > 1) {
        console.log(`\nFound duplicate ${type} formats for Company ${companyId}:`);
        for (const f of formats) {
          console.log(`  - Format ID: ${f.id}, Versions: ${f.versions.length}`);
        }

        // Sort formats to keep the best one
        const sorted = [...formats].sort((a, b) => {
          const aLatestFields = Array.isArray(a.versions[0]?.fields_schema) ? a.versions[0].fields_schema.length : 0;
          const bLatestFields = Array.isArray(b.versions[0]?.fields_schema) ? b.versions[0].fields_schema.length : 0;
          if (aLatestFields !== bLatestFields) {
            return bLatestFields - aLatestFields; // Descending
          }
          if (a.versions.length !== b.versions.length) {
            return b.versions.length - a.versions.length; // Descending
          }
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); // Ascending
        });

        const keep = sorted[0];
        const toDelete = sorted.slice(1);

        console.log(`--> KEEPING Format ID: ${keep.id}`);
        for (const del of toDelete) {
          console.log(`--> DELETING Format ID: ${del.id}`);
          await sysPrisma.reportFormatVersion.deleteMany({
            where: { format_id: del.id }
          });
          await sysPrisma.reportFormat.delete({
            where: { id: del.id }
          });
        }
      }
    }

    console.log('\nDone.');
  } finally {
    await sysPrisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
