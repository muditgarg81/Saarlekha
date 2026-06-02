"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../db/prisma");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const async_hooks_1 = require("async_hooks");
const pg_1 = __importDefault(require("pg"));
async function runRLSTests() {
    console.log('Starting Row-Level Security (RLS) Tenant Isolation Tests...');
    let success = true;
    // 1. Create a Prisma Client that connects as saarlekha_app
    const ownerUrl = process.env.DATABASE_URL || '';
    let appUrl = ownerUrl.replace('neondb_owner:npg_xNgMoVY29bKA', 'saarlekha_app:saarlekha_secure_pass');
    appUrl = appUrl.replace('-pooler', '');
    console.log('Connecting to database as saarlekha_app role...');
    const pool = new pg_1.default.Pool({ connectionString: appUrl });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    const appPrisma = new client_1.PrismaClient({ adapter });
    // Custom tenant Prisma helper for app client
    const rlsStorage = new async_hooks_1.AsyncLocalStorage();
    function getAppTenantPrisma(companyId) {
        return appPrisma.$extends({
            query: {
                $allModels: {
                    async $allOperations({ model, operation, args, query }) {
                        if (rlsStorage.getStore()) {
                            return query(args);
                        }
                        return appPrisma.$transaction(async (tx) => {
                            await tx.$executeRaw `SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
                            return rlsStorage.run(true, () => {
                                return tx[model][operation](args);
                            });
                        });
                    },
                },
            },
        });
    }
    try {
        // Check saarlekha_app roles config
        const roles = await appPrisma.$queryRaw `
      SELECT rolname, rolbypassrls, rolsuper 
      FROM pg_roles 
      WHERE rolname = current_user
    `;
        console.log('Test Client DB Role:', roles);
        // 2. Setup test data using owner client (with config parameters set)
        console.log('Setting up test companies and customers...');
        const companyA = await prisma_1.prisma.company.create({
            data: { name: 'Test Company A', address: '123 Alpha St' }
        });
        const companyB = await prisma_1.prisma.company.create({
            data: { name: 'Test Company B', address: '456 Beta St' }
        });
        const customerA = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${companyA.id}', true)`);
            return tx.customer.create({
                data: {
                    company_id: companyA.id,
                    name: 'Customer Belongs To A',
                }
            });
        });
        const customerB = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${companyB.id}', true)`);
            return tx.customer.create({
                data: {
                    company_id: companyB.id,
                    name: 'Customer Belongs To B',
                }
            });
        });
        console.log(`Created Customer A (under A): ${customerA.id}`);
        console.log(`Created Customer B (under B): ${customerB.id}`);
        // 3. Test isolation under Tenant A context using app client
        console.log('\n--- Testing under Company A Context (using saarlekha_app client) ---');
        const prismaTenantA = getAppTenantPrisma(companyA.id);
        // Query all customers using Tenant A context
        const customersForA = await prismaTenantA.customer.findMany();
        const hasA = customersForA.some(c => c.id === customerA.id);
        const hasB = customersForA.some(c => c.id === customerB.id);
        console.log(`Query customers: Found ${customersForA.length} customer(s)`);
        if (hasA && !hasB) {
            console.log('✓ SUCCESS: Found Customer A and did NOT find Customer B.');
        }
        else {
            console.error('✗ FAILURE: Company A context leaked Company B data or did not find Customer A.');
            success = false;
        }
        // Try to find Customer B directly by ID under Company A context
        const directFindB = await prismaTenantA.customer.findUnique({
            where: { id: customerB.id }
        });
        if (!directFindB) {
            console.log('✓ SUCCESS: Direct find of Customer B returned null.');
        }
        else {
            console.error('✗ FAILURE: Company A context was able to retrieve Customer B by ID directly!');
            success = false;
        }
        // 4. Test isolation under Tenant B context using app client
        console.log('\n--- Testing under Company B Context (using saarlekha_app client) ---');
        const prismaTenantB = getAppTenantPrisma(companyB.id);
        // Query all customers using Tenant B context
        const customersForB = await prismaTenantB.customer.findMany();
        const hasAInB = customersForB.some(c => c.id === customerA.id);
        const hasBInB = customersForB.some(c => c.id === customerB.id);
        console.log(`Query customers: Found ${customersForB.length} customer(s)`);
        if (hasBInB && !hasAInB) {
            console.log('✓ SUCCESS: Found Customer B and did NOT find Customer A.');
        }
        else {
            console.error('✗ FAILURE: Company B context leaked Company A data or did not find Customer B.');
            success = false;
        }
        // Try to find Customer A directly by ID under Company B context
        const directFindA = await prismaTenantB.customer.findUnique({
            where: { id: customerA.id }
        });
        if (!directFindA) {
            console.log('✓ SUCCESS: Direct find of Customer A returned null.');
        }
        else {
            console.error('✗ FAILURE: Company B context was able to retrieve Customer A by ID directly!');
            success = false;
        }
        // 5. Cleanup using owner client (with config parameters set)
        console.log('\nCleaning up test records...');
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${companyA.id}', true)`);
            await tx.customer.deleteMany({
                where: { id: customerA.id }
            });
        });
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${companyB.id}', true)`);
            await tx.customer.deleteMany({
                where: { id: customerB.id }
            });
        });
        await prisma_1.prisma.company.deleteMany({
            where: { id: { in: [companyA.id, companyB.id] } }
        });
        console.log('Cleanup completed.');
    }
    catch (err) {
        console.error('Test run failed with error:', err);
        success = false;
    }
    finally {
        await appPrisma.$disconnect();
        await pool.end();
    }
    if (success) {
        console.log('\n=========================================');
        console.log('ALL RLS TENANT ISOLATION TESTS PASSED! 🎉');
        console.log('=========================================');
        process.exit(0);
    }
    else {
        console.error('\n=========================================');
        console.error('SOME RLS TESTS FAILED! ✗');
        console.error('=========================================');
        process.exit(1);
    }
}
runRLSTests();
