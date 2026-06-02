"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const async_hooks_1 = require("async_hooks");
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
const bcrypt_1 = __importDefault(require("bcrypt"));
dotenv_1.default.config();
async function runRLSInviteTests() {
    console.log('Starting Row-Level Security (RLS) Invite Verification Tests...');
    let success = true;
    const ownerUrl = process.env.DATABASE_URL || '';
    const ownerConnectionString = ownerUrl.replace('-pooler', '');
    // Connect as owner (bypasses RLS) for data setup/teardown
    console.log('Connecting as owner database user...');
    const ownerPool = new pg_1.default.Pool({ connectionString: ownerConnectionString });
    const ownerAdapter = new adapter_pg_1.PrismaPg(ownerPool);
    const ownerPrisma = new client_1.PrismaClient({ adapter: ownerAdapter });
    // Connect as saarlekha_app (enforces RLS) for RLS testing
    let appUrl = ownerUrl.replace('neondb_owner:npg_xNgMoVY29bKA', 'saarlekha_app:saarlekha_secure_pass');
    appUrl = appUrl.replace('-pooler', '');
    console.log('Connecting to database as saarlekha_app role...');
    const appPool = new pg_1.default.Pool({ connectionString: appUrl });
    const appAdapter = new adapter_pg_1.PrismaPg(appPool);
    const appPrisma = new client_1.PrismaClient({ adapter: appAdapter });
    // Custom tenant Prisma helper for app client
    const rlsStorage = new async_hooks_1.AsyncLocalStorage();
    function getAppTenantPrisma(companyId, role) {
        return appPrisma.$extends({
            query: {
                $allModels: {
                    async $allOperations({ model, operation, args, query }) {
                        if (rlsStorage.getStore()) {
                            return query(args);
                        }
                        return appPrisma.$transaction(async (tx) => {
                            await tx.$executeRaw `SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
                            if (role) {
                                await tx.$executeRaw `SELECT set_config('app.current_user_role', ${role}, true)`;
                            }
                            else {
                                await tx.$executeRaw `SELECT set_config('app.current_user_role', '', true)`;
                            }
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
        // 1. Setup test data using owner client
        console.log('Setting up test companies...');
        const companyA = await ownerPrisma.company.create({
            data: { name: 'Invite Test Company A', address: '123 Alpha St' }
        });
        const companyB = await ownerPrisma.company.create({
            data: { name: 'Invite Test Company B', address: '456 Beta St' }
        });
        const deptA = await ownerPrisma.department.create({
            data: { name: 'Department A', company_id: companyA.id }
        });
        const hashedPassword = await bcrypt_1.default.hash('Password123', 12);
        // Create Company Admin A for Company A
        const adminA = await ownerPrisma.user.create({
            data: {
                email: 'admina_invite@test.com',
                password_hash: hashedPassword,
                role: 'COMPANY_ADMIN',
                company_id: companyA.id,
                is_email_verified: true
            }
        });
        // Obtain the tenant Prisma client for Company A (enforced under RLS)
        const prismaTenantA = getAppTenantPrisma(companyA.id, 'COMPANY_ADMIN');
        console.log('\n--- 1. Testing Authorized OPERATIONS Invite under Company A context ---');
        let invitedUserA;
        try {
            invitedUserA = await prismaTenantA.user.create({
                data: {
                    email: 'invited_ops_a@test.com',
                    role: 'OPERATIONS',
                    company_id: companyA.id,
                }
            });
            console.log('✓ SUCCESS: User created under Company A context with company_id of A.');
        }
        catch (err) {
            console.error('✗ FAILURE: User creation failed under Company A context:', err.message);
            success = false;
        }
        if (invitedUserA) {
            console.log('\n--- 2. Testing Token creation for invited user under Company A context ---');
            try {
                const token = await prismaTenantA.token.create({
                    data: {
                        token: 'test-invite-token-a-123',
                        type: 'INVITE',
                        user_id: invitedUserA.id,
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
                    }
                });
                console.log('✓ SUCCESS: Token created for invited user under Company A context.');
            }
            catch (err) {
                console.error('✗ FAILURE: Token creation failed under Company A context:', err.message);
                success = false;
            }
        }
        console.log('\n--- 3. Testing Blocked User creation with Company B company_id under Company A context ---');
        try {
            await prismaTenantA.user.create({
                data: {
                    email: 'invited_ops_b_under_a@test.com',
                    role: 'OPERATIONS',
                    company_id: companyB.id,
                }
            });
            console.error('✗ FAILURE: User creation with company_id of B under Company A context was NOT blocked!');
            success = false;
        }
        catch (err) {
            console.log('✓ SUCCESS: User creation blocked by RLS WITH CHECK policy. Error details:', err.meta?.driverAdapterError?.cause?.message || err.message);
        }
        // Clean up all resources
        console.log('\nCleaning up invite test records...');
        if (invitedUserA) {
            await ownerPrisma.token.deleteMany({ where: { user_id: invitedUserA.id } });
            await ownerPrisma.user.delete({ where: { id: invitedUserA.id } });
        }
        await ownerPrisma.user.delete({ where: { id: adminA.id } });
        await ownerPrisma.department.delete({ where: { id: deptA.id } });
        await ownerPrisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
        console.log('Cleanup completed.');
    }
    catch (err) {
        console.error('Test script crashed:', err);
        success = false;
    }
    console.log('\n=========================================');
    if (success) {
        console.log('ALL RLS INVITE PROTECTION TESTS PASSED SUCCESSFULLY! 🎉');
        process.exit(0);
    }
    else {
        console.error('✗ SOME RLS INVITE PROTECTION TESTS FAILED!');
        process.exit(1);
    }
}
runRLSInviteTests();
