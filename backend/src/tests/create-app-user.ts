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

async function createAppUser() {
  try {
    console.log('Attempting to create non-owner app user...');
    try {
      await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS saarlekha_app;`);
    } catch (err) {
      console.log('Skipping drop role if it fails...');
    }
    try {
      await prisma.$executeRawUnsafe(`CREATE ROLE saarlekha_app WITH LOGIN PASSWORD 'saarlekha_secure_pass';`);
    } catch (err) {
      console.log('Role saarlekha_app might already exist. Continuing to grants...');
    }
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO saarlekha_app;`);
    await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO saarlekha_app;`);
    await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO saarlekha_app;`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO saarlekha_app;`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO saarlekha_app;`);
    console.log('✓ Successfully configured saarlekha_app permissions!');
  } catch (err) {
    console.error('✗ Failed to create app user:', err);
  }
  process.exit(0);
}

createAppUser();
