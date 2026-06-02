"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
let connectionString = process.env.DATABASE_URL || '';
connectionString = connectionString.replace('-pooler', '');
const pool = new pg_1.default.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function applyRLSCheck() {
    try {
        console.log('Reading migration SQL...');
        const sqlPath = path_1.default.join(__dirname, '../../prisma/migrations/20260601155000_add_rls_with_check/migration.sql');
        const sql = fs_1.default.readFileSync(sqlPath, 'utf-8');
        console.log('Applying RLS with CHECK policies to database...');
        await pool.query(sql);
        console.log('Reading audit log migration SQL...');
        const auditSqlPath = path_1.default.join(__dirname, '../../prisma/migrations/20260601155500_update_audit_log_rls/migration.sql');
        const auditSql = fs_1.default.readFileSync(auditSqlPath, 'utf-8');
        console.log('Applying updated AuditLogEntry policy to database...');
        await pool.query(auditSql);
        console.log('Reading user table migration SQL...');
        const userSqlPath = path_1.default.join(__dirname, '../../prisma/migrations/20260601160000_enable_user_rls/migration.sql');
        const userSql = fs_1.default.readFileSync(userSqlPath, 'utf-8');
        console.log('Applying User table RLS policy to database...');
        await pool.query(userSql);
        console.log('✓ Successfully applied all RLS policies!');
    }
    catch (err) {
        console.error('✗ Failed to apply policies:', err);
        process.exit(1);
    }
    process.exit(0);
}
applyRLSCheck();
