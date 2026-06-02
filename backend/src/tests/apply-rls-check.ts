import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

let connectionString = process.env.DATABASE_URL || '';
connectionString = connectionString.replace('-pooler', '');
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function applyRLSCheck() {
  try {
    console.log('Reading migration SQL...');
    const sqlPath = path.join(__dirname, '../../prisma/migrations/20260601155000_add_rls_with_check/migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('Applying RLS with CHECK policies to database...');
    await pool.query(sql);

    console.log('Reading audit log migration SQL...');
    const auditSqlPath = path.join(__dirname, '../../prisma/migrations/20260601155500_update_audit_log_rls/migration.sql');
    const auditSql = fs.readFileSync(auditSqlPath, 'utf-8');

    console.log('Applying updated AuditLogEntry policy to database...');
    await pool.query(auditSql);

    console.log('Reading user table migration SQL...');
    const userSqlPath = path.join(__dirname, '../../prisma/migrations/20260601160000_enable_user_rls/migration.sql');
    const userSql = fs.readFileSync(userSqlPath, 'utf-8');

    console.log('Applying User table RLS policy to database...');
    await pool.query(userSql);
    console.log('✓ Successfully applied all RLS policies!');
  } catch (err) {
    console.error('✗ Failed to apply policies:', err);
    process.exit(1);
  }
  process.exit(0);
}

applyRLSCheck();
