import { prisma } from '../db/prisma';

async function disableBypass() {
  try {
    console.log('Attempting to disable BYPASSRLS for neondb_owner...');
    await prisma.$executeRawUnsafe(`ALTER ROLE neondb_owner NOBYPASSRLS;`);
    console.log('✓ Successfully altered role to NOBYPASSRLS!');
  } catch (err) {
    console.error('✗ Failed to alter role:', err);
  }
  process.exit(0);
}

disableBypass();
