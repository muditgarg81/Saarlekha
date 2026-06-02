"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function main() {
    const connectionString = process.env.DATABASE_URL || '';
    const directUrl = connectionString.replace('-pooler', '');
    const pool = new pg_1.default.Pool({ connectionString: directUrl });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    const prisma = new client_1.PrismaClient({ adapter });
    try {
        console.log('Querying schema owner and privileges...');
        const schemaPrivs = await prisma.$queryRaw `
      SELECT schema_name, schema_owner, 
             has_schema_privilege('saarlekha_app', schema_name, 'USAGE') as has_usage,
             has_schema_privilege('saarlekha_app', schema_name, 'CREATE') as has_create
      FROM information_schema.schemata
      WHERE schema_name = 'public';
    `;
        console.log('Schema public privileges:', schemaPrivs);
        const tablePrivs = await prisma.$queryRaw `
      SELECT table_name, 
             has_table_privilege('saarlekha_app', '"' || table_name || '"', 'SELECT') as has_select,
             has_table_privilege('saarlekha_app', '"' || table_name || '"', 'INSERT') as has_insert,
             has_table_privilege('saarlekha_app', '"' || table_name || '"', 'UPDATE') as has_update,
             has_table_privilege('saarlekha_app', '"' || table_name || '"', 'DELETE') as has_delete
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name NOT LIKE '_prisma%';
    `;
        console.log('Table privileges for saarlekha_app:');
        console.log(JSON.stringify(tablePrivs, null, 2));
    }
    catch (err) {
        console.error('Error querying privileges:', err);
    }
    finally {
        await prisma.$disconnect();
        await pool.end();
    }
}
main();
