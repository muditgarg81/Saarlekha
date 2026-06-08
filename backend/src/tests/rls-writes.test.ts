import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'async_hooks';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function runRLSWriteTests() {
  console.log('Starting Row-Level Security (RLS) Cross-Tenant Write Isolation Tests...');
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
  function getAppTenantPrisma(companyId: string) {
    return appPrisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (rlsStorage.getStore()) {
              return query(args);
            }
            return appPrisma.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
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
    console.log('Setting up test companies and prerequisites...');
    const companyA = await ownerPrisma.company.create({
      data: { name: 'Write Test Company A', address: '123 Alpha St' }
    });
    const companyB = await ownerPrisma.company.create({
      data: { name: 'Write Test Company B', address: '456 Beta St' }
    });

    // Create Departments
    const deptA = await ownerPrisma.department.create({
      data: { name: 'Dept A', company_id: companyA.id }
    });
    const deptB = await ownerPrisma.department.create({
      data: { name: 'Dept B', company_id: companyB.id }
    });

    // Create Manpower
    const operatorA = await ownerPrisma.manpower.create({
      data: { name: 'Operator A', company_id: companyA.id, department_id: deptA.id }
    });

    // Create Machines
    const machineA = await ownerPrisma.machine.create({
      data: { name: 'Machine A', company_id: companyA.id, department_id: deptA.id }
    });

    // Create Report Formats & Versions
    const formatA = await ownerPrisma.reportFormat.create({
      data: { name: 'Format A', type: 'GENERAL', company_id: companyA.id }
    });
    const versionA = await ownerPrisma.reportFormatVersion.create({
      data: { format_id: formatA.id, version_num: 1, fields_schema: [] }
    });

    // Create Users
    const userA = await ownerPrisma.user.create({
      data: { email: 'userA_write@test.com', role: 'OPERATIONS', company_id: companyA.id, is_email_verified: true }
    });

    // Obtain the tenant Prisma client for Company A (enforced under RLS)
    const prismaTenantA = getAppTenantPrisma(companyA.id);

    console.log('\n--- 1. Testing Customer writes ---');
    {
      // Insert with B's company_id under Company A's context
      try {
        await prismaTenantA.customer.create({
          data: { name: 'Cross Customer', company_id: companyB.id }
        });
        console.error('✗ FAILURE: Customer INSERT with company_id of B was NOT blocked!');
        success = false;
      } catch (err: any) {
        console.log('✓ SUCCESS: Customer INSERT blocked. Error details:', err.meta?.driverAdapterError?.cause?.message || err.message);
      }

      // Create a valid Customer under A (using owner)
      const validCustomerA = await ownerPrisma.customer.create({
        data: { name: 'Valid Customer A', company_id: companyA.id }
      });
      // Try updating its company_id to B's id under Tenant A context
      try {
        await prismaTenantA.customer.update({
          where: { id: validCustomerA.id },
          data: { company_id: companyB.id }
        });
        console.error('✗ FAILURE: Customer UPDATE to company_id of B was NOT blocked!');
        success = false;
      } catch (err: any) {
        console.log('✓ SUCCESS: Customer UPDATE blocked. Error details:', err.meta?.driverAdapterError?.cause?.message || err.message);
      }
    }

    console.log('\n--- 2. Testing Manpower writes ---');
    {
      // Insert with B's company_id under Company A's context
      try {
        await prismaTenantA.manpower.create({
          data: { name: 'Cross Manpower', company_id: companyB.id, department_id: deptA.id }
        });
        console.error('✗ FAILURE: Manpower INSERT with company_id of B was NOT blocked!');
        success = false;
      } catch (err: any) {
        console.log('✓ SUCCESS: Manpower INSERT blocked. Error details:', err.meta?.driverAdapterError?.cause?.message || err.message);
      }

      // Try updating valid Manpower to B's id under Tenant A context
      try {
        await prismaTenantA.manpower.update({
          where: { id: operatorA.id },
          data: { company_id: companyB.id }
        });
        console.error('✗ FAILURE: Manpower UPDATE to company_id of B was NOT blocked!');
        success = false;
      } catch (err: any) {
        console.log('✓ SUCCESS: Manpower UPDATE blocked. Error details:', err.meta?.driverAdapterError?.cause?.message || err.message);
      }
    }

    console.log('\n--- 3. Testing ReportEntry writes ---');
    {
      // Insert with B's company_id under Company A's context
      try {
        await prismaTenantA.reportEntry.create({
          data: {
            company_id: companyB.id,
            format_version_id: versionA.id,
            department_id: deptA.id,
            submitted_by: userA.id,
            entry_date: new Date(),
            payload: {}
          }
        });
        console.error('✗ FAILURE: ReportEntry INSERT with company_id of B was NOT blocked!');
        success = false;
      } catch (err: any) {
        console.log('✓ SUCCESS: ReportEntry INSERT blocked. Error details:', err.meta?.driverAdapterError?.cause?.message || err.message);
      }

      // Create a valid ReportEntry under A
      const entryA = await ownerPrisma.reportEntry.create({
        data: {
          company_id: companyA.id,
          format_version_id: versionA.id,
          department_id: deptA.id,
          submitted_by: userA.id,
          entry_date: new Date(),
          payload: {}
        }
      });
      // Try updating its company_id to B's id
      try {
        await prismaTenantA.reportEntry.update({
          where: { id: entryA.id },
          data: { company_id: companyB.id }
        });
        console.error('✗ FAILURE: ReportEntry UPDATE to company_id of B was NOT blocked!');
        success = false;
      } catch (err: any) {
        console.log('✓ SUCCESS: ReportEntry UPDATE blocked. Error details:', err.meta?.driverAdapterError?.cause?.message || err.message);
      }
    }

    console.log('\n--- 4. Testing JobOrder writes ---');
    {
      const customerA = await ownerPrisma.customer.create({
        data: { name: 'Cust A', company_id: companyA.id }
      });
      // Insert with B's company_id under Company A's context
      try {
        await prismaTenantA.jobOrder.create({
          data: {
            company_id: companyB.id,
            order_number: 'JO-X',
            customer_id: customerA.id,
            status: 'OPEN'
          }
        });
        console.error('✗ FAILURE: JobOrder INSERT with company_id of B was NOT blocked!');
        success = false;
      } catch (err: any) {
        console.log('✓ SUCCESS: JobOrder INSERT blocked. Error details:', err.meta?.driverAdapterError?.cause?.message || err.message);
      }

      // Create valid JobOrder under A
      const joA = await ownerPrisma.jobOrder.create({
        data: {
          company_id: companyA.id,
          order_number: 'JO-A',
          customer_id: customerA.id,
          status: 'OPEN'
        }
      });
      // Try updating its company_id to B's id
      try {
        await prismaTenantA.jobOrder.update({
          where: { id: joA.id },
          data: { company_id: companyB.id }
        });
        console.error('✗ FAILURE: JobOrder UPDATE to company_id of B was NOT blocked!');
        success = false;
      } catch (err: any) {
        console.log('✓ SUCCESS: JobOrder UPDATE blocked. Error details:', err.meta?.driverAdapterError?.cause?.message || err.message);
      }
    }

    console.log('\n--- 5. Testing ProductionRecord writes ---');
    {
      // Insert with B's company_id under Company A's context
      try {
        await prismaTenantA.productionRecord.create({
          data: {
            company_id: companyB.id,
            date: new Date(),
            production_amount: 10,
            target_amount: 10,
            operator_id: operatorA.id,
            machine_id: machineA.id,
            department_id: deptA.id
          }
        });
        console.error('✗ FAILURE: ProductionRecord INSERT with company_id of B was NOT blocked!');
        success = false;
      } catch (err: any) {
        console.log('✓ SUCCESS: ProductionRecord INSERT blocked. Error details:', err.meta?.driverAdapterError?.cause?.message || err.message);
      }

      // Create valid ProductionRecord under A
      const prodA = await ownerPrisma.productionRecord.create({
        data: {
          company_id: companyA.id,
          date: new Date(),
          production_amount: 10,
          target_amount: 10,
          operator_id: operatorA.id,
          machine_id: machineA.id,
          department_id: deptA.id
        }
      });
      // Try updating its company_id to B's id
      try {
        await prismaTenantA.productionRecord.update({
          where: { id: prodA.id },
          data: { company_id: companyB.id }
        });
        console.error('✗ FAILURE: ProductionRecord UPDATE to company_id of B was NOT blocked!');
        success = false;
      } catch (err: any) {
        console.log('✓ SUCCESS: ProductionRecord UPDATE blocked. Error details:', err.meta?.driverAdapterError?.cause?.message || err.message);
      }
    }

    // Clean up all resources
    console.log('\nCleaning up write test records...');
    await ownerPrisma.productionRecord.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await ownerPrisma.jobOrder.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await ownerPrisma.reportEntry.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await ownerPrisma.reportFormatVersion.deleteMany({ where: { format_id: formatA.id } });
    await ownerPrisma.reportFormat.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await ownerPrisma.user.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await ownerPrisma.machine.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await ownerPrisma.manpower.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await ownerPrisma.customer.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await ownerPrisma.department.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await ownerPrisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    console.log('Cleanup completed.');

  } catch (err) {
    console.error('Test script crashed:', err);
    success = false;
  }

  console.log('\n=========================================');
  if (success) {
    console.log('ALL RLS WRITE PROTECTION TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } else {
    console.error('✗ SOME RLS WRITE ISOLATION TESTS FAILED!');
    process.exit(1);
  }
}

runRLSWriteTests();
