import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'async_hooks';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

async function runUserRLSTests() {
  console.log('Starting User Table RLS Isolation Tests...');
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
  function getAppTenantPrisma(companyId: string, loginEmail?: string) {
    return appPrisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (rlsStorage.getStore()) {
              return query(args);
            }
            return appPrisma.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
              if (loginEmail) {
                await tx.$executeRaw`SELECT set_config('app.login_email', ${loginEmail}, true)`;
              } else {
                await tx.$executeRaw`SELECT set_config('app.login_email', '', true)`;
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
    console.log('Setting up test companies and users...');
    const companyA = await ownerPrisma.company.create({
      data: { name: 'User RLS Company A', address: '123 Alpha St' }
    });
    const companyB = await ownerPrisma.company.create({
      data: { name: 'User RLS Company B', address: '456 Beta St' }
    });

    const hashedPassword = await bcrypt.hash('Password123', 12);
    const userA = await ownerPrisma.user.create({
      data: { email: 'usera_login@test.com', password_hash: hashedPassword, role: 'COMPANY_ADMIN', company_id: companyA.id }
    });
    const userB = await ownerPrisma.user.create({
      data: { email: 'userb_login@test.com', password_hash: hashedPassword, role: 'OPERATIONS', company_id: companyB.id }
    });

    console.log('\n--- 1. Testing user listing isolation under Company A Context ---');
    {
      const prismaTenantA = getAppTenantPrisma(companyA.id);

      const users = await prismaTenantA.user.findMany();
      console.log(`Found ${users.length} user(s)`);
      const hasA = users.some(u => u.id === userA.id);
      const hasB = users.some(u => u.id === userB.id);

      if (hasA && !hasB) {
        console.log('✓ SUCCESS: Company A context can read User A but NOT User B.');
      } else {
        console.error('✗ FAILURE: User listing leaked B or missed A. hasA:', hasA, 'hasB:', hasB);
        success = false;
      }
    }

    console.log('\n--- 2. Testing login flow simulation (pre-auth, no tenant context) ---');
    {
      // Simulate login fetch for User A: app.current_tenant_id is empty, but app.login_email = User A's email
      const prismaLoginA = getAppTenantPrisma('', 'usera_login@test.com');
      const user = await prismaLoginA.user.findUnique({
        where: { email: 'usera_login@test.com' }
      });

      if (user && user.id === userA.id) {
        console.log('✓ SUCCESS: Login lookup successfully retrieved User A using session email context.');
      } else {
        console.error('✗ FAILURE: Login lookup failed to retrieve User A.');
        success = false;
      }

      // Simulate login fetch for a non-matching email
      const userMismatch = await prismaLoginA.user.findUnique({
        where: { email: 'userb_login@test.com' }
      });

      if (!userMismatch) {
        console.log('✓ SUCCESS: Login lookup for unauthorized User B returned null under User A\'s session email context.');
      } else {
        console.error('✗ FAILURE: Login lookup allowed fetching User B under User A\'s login email context!');
        success = false;
      }
    }

    console.log('\n--- 3. Testing listing without tenant context or login context ---');
    {
      const prismaUnauth = getAppTenantPrisma('');
      const users = await prismaUnauth.user.findMany();
      if (users.length === 0) {
        console.log('✓ SUCCESS: General user listing without context returned 0 users.');
      } else {
        console.error(`✗ FAILURE: Leaked ${users.length} users under unauthenticated general query.`);
        success = false;
      }
    }

    // Clean up all resources
    console.log('\nCleaning up User test records...');
    await ownerPrisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await ownerPrisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    console.log('Cleanup completed.');

  } catch (err) {
    console.error('Test script crashed:', err);
    success = false;
  }

  console.log('\n=========================================');
  if (success) {
    console.log('ALL USER RLS ISOLATION TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } else {
    console.error('✗ SOME USER RLS ISOLATION TESTS FAILED!');
    process.exit(1);
  }
}

runUserRLSTests();
