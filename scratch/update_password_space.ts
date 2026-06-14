import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

let connectionString = process.env.DATABASE_URL || '';
connectionString = connectionString.replace('-pooler', '');
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    console.log('Altering saarlekha_app role password to have a leading space...');
    await prisma.$executeRawUnsafe(`ALTER ROLE saarlekha_app WITH PASSWORD ' npg_EALl9dSWJKg6';`);
    console.log('✓ Successfully altered password to have a leading space!');
  } catch (err) {
    console.error('✗ Failed to alter password:', err);
  }
  process.exit(0);
}

run();
