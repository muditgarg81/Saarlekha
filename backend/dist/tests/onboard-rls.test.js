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
async function runOnboardRLSTests() {
    console.log('Starting Company Onboarding RLS Policy & Transaction Verification Tests...');
    let success = true;
    const ownerUrl = process.env.DATABASE_URL || '';
    const ownerConnectionString = ownerUrl.replace('-pooler', '');
    // Connect as owner (bypasses RLS) for verification and cleanup
    console.log('Connecting as owner database user...');
    const ownerPool = new pg_1.default.Pool({ connectionString: ownerConnectionString });
    const ownerAdapter = new adapter_pg_1.PrismaPg(ownerPool);
    const ownerPrisma = new client_1.PrismaClient({ adapter: ownerAdapter });
    // Connect as saarlekha_app (enforces RLS) to test onboarding behavior under RLS
    let appUrl = ownerUrl.replace('neondb_owner:npg_xNgMoVY29bKA', 'saarlekha_app:saarlekha_secure_pass');
    appUrl = appUrl.replace('-pooler', '');
    console.log('Connecting to database as saarlekha_app role...');
    const appPool = new pg_1.default.Pool({ connectionString: appUrl });
    const appAdapter = new adapter_pg_1.PrismaPg(appPool);
    const appPrisma = new client_1.PrismaClient({ adapter: appAdapter });
    try {
        console.log('\n--- Test 1: Simulating Onboarding WITHOUT setting app.current_tenant_id ---');
        try {
            await appPrisma.$transaction(async (tx) => {
                // 1. Create company
                const company = await tx.company.create({
                    data: { name: 'Failed Onboarding Company', address: '123 Test Rd' }
                });
                // 2. Try to insert company admin user WITHOUT setting app.current_tenant_id first
                // This is expected to fail because the admin's company_id does not match the active session tenant (empty/unauth context)
                await tx.user.create({
                    data: {
                        email: 'failed_admin_onboard@test.com',
                        role: 'COMPANY_ADMIN',
                        company_id: company.id,
                        is_email_verified: false
                    }
                });
            });
            console.error('✗ FAILURE: Onboarding user creation WITHOUT app.current_tenant_id was NOT blocked!');
            success = false;
        }
        catch (err) {
            const errMsg = err.meta?.driverAdapterError?.cause?.message || err.message;
            if (errMsg.includes('violates row-level security policy')) {
                console.log('✓ SUCCESS: Onboarding user creation blocked by RLS policy when tenant context is unset.');
            }
            else {
                console.error('✗ FAILURE: Onboarding failed with unexpected error:', errMsg);
                success = false;
            }
        }
        console.log('\n--- Test 2: Simulating Onboarding WITH setting app.current_tenant_id in transaction ---');
        let createdCompany = null;
        let createdUser = null;
        try {
            const result = await appPrisma.$transaction(async (tx) => {
                // 1. Create company
                const company = await tx.company.create({
                    data: { name: 'Successful Onboarding Company', address: '456 Verified Rd' }
                });
                // 2. Set current tenant ID to the new company's ID within the transaction
                await tx.$executeRaw `SELECT set_config('app.current_tenant_id', ${company.id}, true)`;
                await tx.$executeRaw `SELECT set_config('app.current_user_role', 'SUPER_ADMIN', true)`;
                // 3. Insert company admin user
                const user = await tx.user.create({
                    data: {
                        email: 'success_admin_onboard@test.com',
                        role: 'COMPANY_ADMIN',
                        company_id: company.id,
                        is_email_verified: false
                    }
                });
                // 4. Create an audit log entry
                await tx.auditLogEntry.create({
                    data: {
                        user_id: user.id, // using newly created admin user id for test logging
                        action: 'CREATE',
                        entity_type: 'Company',
                        entity_id: company.id,
                        company_id: company.id,
                        details: { name: company.name }
                    }
                });
                return { company, user };
            });
            createdCompany = result.company;
            createdUser = result.user;
            console.log('✓ SUCCESS: Transaction completed successfully!');
            console.log(`- Created Company ID: ${createdCompany.id}`);
            console.log(`- Created User ID: ${createdUser.id}, Email: ${createdUser.email}, Company ID: ${createdUser.company_id}`);
            if (createdUser.company_id === createdCompany.id) {
                console.log('✓ SUCCESS: Admin User was created with the correct company_id.');
            }
            else {
                console.error(`✗ FAILURE: Created User company_id mismatch! Expected ${createdCompany.id}, got ${createdUser.company_id}`);
                success = false;
            }
        }
        catch (err) {
            console.error('✗ FAILURE: Onboarding transaction failed with error:', err.meta?.driverAdapterError?.cause?.message || err.message);
            success = false;
        }
        // Verification check using owner client
        if (createdCompany && createdUser) {
            console.log('\n--- Test 3: Verifying records exist in database via owner connection ---');
            const companyRecord = await ownerPrisma.company.findUnique({ where: { id: createdCompany.id } });
            const userRecord = await ownerPrisma.user.findUnique({ where: { id: createdUser.id } });
            if (companyRecord && userRecord) {
                console.log('✓ SUCCESS: Both company and admin user records verified to exist in DB.');
            }
            else {
                console.error('✗ FAILURE: Records not found in DB using owner bypass client.');
                success = false;
            }
        }
        // Clean up test data
        console.log('\nCleaning up onboarding test records...');
        const failedCompany = await ownerPrisma.company.findFirst({ where: { name: 'Failed Onboarding Company' } });
        if (failedCompany) {
            await ownerPrisma.company.delete({ where: { id: failedCompany.id } });
        }
        if (createdCompany) {
            await ownerPrisma.auditLogEntry.deleteMany({ where: { company_id: createdCompany.id } });
            await ownerPrisma.user.deleteMany({ where: { company_id: createdCompany.id } });
            await ownerPrisma.company.delete({ where: { id: createdCompany.id } });
        }
        console.log('Cleanup completed.');
    }
    catch (err) {
        console.error('Test script crashed:', err);
        success = false;
    }
    finally {
        await appPrisma.$disconnect();
        await ownerPrisma.$disconnect();
        await appPool.end();
        await ownerPool.end();
    }
    console.log('\n=========================================');
    if (success) {
        console.log('ALL ONBOARDING RLS TESTS PASSED SUCCESSFULLY! 🎉');
        process.exit(0);
    }
    else {
        console.error('✗ SOME ONBOARDING RLS TESTS FAILED!');
        process.exit(1);
    }
}
runOnboardRLSTests();
