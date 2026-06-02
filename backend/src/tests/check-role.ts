import { prisma } from '../db/prisma';

async function checkRole() {
  try {
    const roles: any = await prisma.$queryRaw`
      SELECT rolname, rolbypassrls, rolsuper 
      FROM pg_roles 
      WHERE rolname = current_user
    `;
    console.log('Current DB User Roles info:', roles);
  } catch (err) {
    console.error('Failed to query roles:', err);
  }
  process.exit(0);
}

checkRole();
