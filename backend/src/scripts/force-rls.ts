import { prisma } from '../db/prisma';

async function forceRLS() {
  const tables = [
    'Department',
    'Manpower',
    'Customer',
    'Item',
    'ReportFormat',
    'ReportFormatVersion',
    'ReportEntry',
    'JobOrder',
    'Machine',
    'ProductionRecord',
    'AuditLogEntry'
  ];

  for (const table of tables) {
    try {
      console.log(`Forcing RLS on "${table}"...`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      console.log(`✓ Forced RLS on "${table}"`);
    } catch (err) {
      console.error(`✗ Failed to force RLS on "${table}":`, err);
    }
  }
  console.log('Completed database RLS updates.');
  process.exit(0);
}

forceRLS();
