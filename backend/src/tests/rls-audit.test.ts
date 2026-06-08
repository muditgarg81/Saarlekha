import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'async_hooks';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function runAuditRLSTests() {
  console.log('Starting Audit Log Entry RLS Isolation Tests...');
  let success = true;

  const ownerUrl = process.env.DATABASE_URL || '';
  const ownerConnectionString = ownerUrl.replace('-pooler', '');
  
  // Connect as owner (bypasses RLS) for data setup/teardown
  console.log('Connecting as owner database user...');
  const ownerPool = new pg.Pool({ connectionString: ownerConnectionString });
  const ownerAdapter = new PrismaPg(ownerPool);
  const ownerPrisma = new PrismaClient({ adapter: ownerAdapter });

  // Connect as saarlekha_app (enforces RLS) for RLS testing
  let appUrl = process.env.APP_DATABASE_URL || ownerUrl.replace(/(postgresql:\/\/)([^@]+)(@)/, '$1saarlekha_app:saarlekha_secure_pass$3');
  appUrl = appUrl.replace('-pooler', '');
  console.log('Connecting to database as saarlekha_app role...');
  const appPool = new pg.Pool({ connectionString: appUrl });
  const appAdapter = new PrismaPg(appPool);
  const appPrisma = new PrismaClient({ adapter: appAdapter });

  // Custom tenant Prisma helper for app client
  const rlsStorage = new AsyncLocalStorage<boolean>();
  function getAppTenantPrisma(companyId: string, role?: string) {
    return appPrisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (rlsStorage.getStore()) {
              return query(args);
            }
            return appPrisma.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
              if (role) {
                await tx.$executeRaw`SELECT set_config('app.current_user_role', ${role}, true)`;
              } else {
                await tx.$executeRaw`SELECT set_config('app.current_user_role', '', true)`;
              }
              return rlsStorage.run(true, () => {
                return (tx as any)[model][operation](args);
              });
            });
          },
        },
      },
    });
  }

  try {
    // 2. Setup test data using owner client
    console.log('Setting up test companies and audit entries...');
    const companyA = await ownerPrisma.company.create({
      data: { name: 'Audit Test Company A', address: '123 Alpha St' }
    });
    const companyB = await ownerPrisma.company.create({
      data: { name: 'Audit Test Company B', address: '456 Beta St' }
    });

    const userA = await ownerPrisma.user.create({
      data: { email: 'userA_audit@test.com', role: 'COMPANY_ADMIN', company_id: companyA.id, is_email_verified: true }
    });

    // Create Audit entry for A
    const auditA = await ownerPrisma.auditLogEntry.create({
      data: {
        company_id: companyA.id,
        user_id: userA.id,
        action: 'CREATE',
        entity_type: 'Test',
        entity_id: '123',
        details: { msg: 'Log for Company A' }
      }
    });

    // Create Audit entry for B
    const auditB = await ownerPrisma.auditLogEntry.create({
      data: {
        company_id: companyB.id,
        user_id: userA.id,
        action: 'CREATE',
        entity_type: 'Test',
        entity_id: '456',
        details: { msg: 'Log for Company B' }
      }
    });

    // Create platform-level NULL-company_id Audit entry
    const auditNull = await ownerPrisma.auditLogEntry.create({
      data: {
        company_id: null,
        user_id: userA.id,
        action: 'CREATE',
        entity_type: 'Platform',
        entity_id: '789',
        details: { msg: 'Global Platform Log' }
      }
    });

    console.log('\n--- 1. Testing under Company A Context (role = COMPANY_ADMIN) ---');
    {
      const prismaTenantA = getAppTenantPrisma(companyA.id, 'COMPANY_ADMIN');

      // Test 1a: Reading Audit Logs
      const logs = await prismaTenantA.auditLogEntry.findMany();
      console.log(`Found ${logs.length} log(s)`);
      const hasA = logs.some(l => l.id === auditA.id);
      const hasB = logs.some(l => l.id === auditB.id);
      const hasNull = logs.some(l => l.id === auditNull.id);

      if (hasA && !hasB && !hasNull) {
        console.log('✓ SUCCESS: COMPANY_ADMIN found Company A audit logs, but could NOT read Company B or NULL/platform audit logs.');
      } else {
        console.error('✗ FAILURE: COMPANY_ADMIN leaked B or NULL logs. hasA:', hasA, 'hasB:', hasB, 'hasNull:', hasNull);
        success = false;
      }

      // Test 1b: Inserting NULL-company_id Audit Log
      try {
        await prismaTenantA.auditLogEntry.create({
          data: {
            company_id: null,
            user_id: userA.id,
            action: 'CREATE',
            entity_type: 'Test',
            entity_id: '999',
            details: { msg: 'Forbidden Null Insert' }
          }
        });
        console.error('✗ FAILURE: COMPANY_ADMIN successfully inserted a NULL-company_id audit log!');
        success = false;
      } catch (err: any) {
        console.log('✓ SUCCESS: COMPANY_ADMIN INSERT of NULL-company_id audit log was blocked. Error:', err.meta?.driverAdapterError?.cause?.message || err.message);
      }
    }

    console.log('\n--- 2. Testing under Company A Context (role = SUPER_ADMIN) ---');
    {
      const prismaTenantSuper = getAppTenantPrisma(companyA.id, 'SUPER_ADMIN');

      // Test 2a: Reading Audit Logs
      const logs = await prismaTenantSuper.auditLogEntry.findMany();
      console.log(`Found ${logs.length} log(s)`);
      const hasA = logs.some(l => l.id === auditA.id);
      const hasB = logs.some(l => l.id === auditB.id);
      const hasNull = logs.some(l => l.id === auditNull.id);

      if (hasA && hasNull && !hasB) {
        console.log('✓ SUCCESS: SUPER_ADMIN found Company A and NULL/platform audit logs, but could NOT read Company B audit logs.');
      } else {
        console.error('✗ FAILURE: SUPER_ADMIN results mismatch. hasA:', hasA, 'hasNull:', hasNull, 'hasB:', hasB);
        success = false;
      }

      // Test 2b: Inserting NULL-company_id Audit Log
      try {
        const createdLog = await prismaTenantSuper.auditLogEntry.create({
          data: {
            company_id: null,
            user_id: userA.id,
            action: 'CREATE',
            entity_type: 'Test',
            entity_id: '888',
            details: { msg: 'Allowed Null Insert' }
          }
        });
        console.log('✓ SUCCESS: SUPER_ADMIN successfully inserted a NULL-company_id audit log! ID:', createdLog.id);
        // Clean up the created log using owner client
        await ownerPrisma.auditLogEntry.delete({ where: { id: createdLog.id } });
      } catch (err: any) {
        console.error('✗ FAILURE: SUPER_ADMIN INSERT of NULL-company_id audit log was blocked! Error:', err.message);
        success = false;
      }
    }

    // Clean up all resources
    console.log('\nCleaning up write test records...');
    await ownerPrisma.auditLogEntry.deleteMany({ where: { user_id: userA.id } });
    await ownerPrisma.user.delete({ where: { id: userA.id } });
    await ownerPrisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    console.log('Cleanup completed.');

  } catch (err) {
    console.error('Test script crashed:', err);
    success = false;
  }

  console.log('\n=========================================');
  if (success) {
    console.log('ALL AUDIT RLS ISOLATION TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } else {
    console.error('✗ SOME AUDIT RLS ISOLATION TESTS FAILED!');
    process.exit(1);
  }
}

runAuditRLSTests();
