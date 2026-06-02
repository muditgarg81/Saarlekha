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
let connectionString = process.env.DATABASE_URL || '';
connectionString = connectionString.replace('-pooler', '');
const pool = new pg_1.default.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function createAppUser() {
    try {
        console.log('Attempting to create non-owner app user...');
        try {
            await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS saarlekha_app;`);
        }
        catch (err) {
            console.log('Skipping drop role if it fails...');
        }
        try {
            await prisma.$executeRawUnsafe(`CREATE ROLE saarlekha_app WITH LOGIN PASSWORD 'saarlekha_secure_pass';`);
        }
        catch (err) {
            console.log('Role saarlekha_app might already exist. Continuing to grants...');
        }
        await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO saarlekha_app;`);
        await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO saarlekha_app;`);
        await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO saarlekha_app;`);
        await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO saarlekha_app;`);
        await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO saarlekha_app;`);
        console.log('✓ Successfully configured saarlekha_app permissions!');
    }
    catch (err) {
        console.error('✗ Failed to create app user:', err);
    }
    process.exit(0);
}
createAppUser();
