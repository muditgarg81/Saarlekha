import { getTenantPrisma, prisma } from '../db/prisma';

async function runCarryForwardTests() {
  console.log('Starting Backend Carry Forward Last-Value Route Logic Tests...');
  let success = true;

  // Set up the company ID context
  let company = await prisma.company.findFirst({
    where: { name: 'Test Carry Company' }
  });
  if (!company) {
    company = await prisma.company.create({
      data: { name: 'Test Carry Company', address: '789 Carry Rd' }
    });
  }
  const companyId = company.id;
  const tenantPrisma = getTenantPrisma(companyId);

  // Find or create department
  let dept = await tenantPrisma.department.findFirst({
    where: { name: 'Loom' }
  });
  if (!dept) {
    dept = await tenantPrisma.department.create({
      data: { name: 'Loom', company_id: companyId }
    });
  }

  // Find or create user/submitter
  let user = await prisma.user.findFirst({
    where: { email: 'muditgarg81@gmail.com' }
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'muditgarg81@gmail.com',
        role: 'SUPER_ADMIN',
        company_id: companyId,
        is_email_verified: true
      }
    });
  }

  // Create report format & version
  let format = await tenantPrisma.reportFormat.create({
    data: {
      name: 'Test Carry Format ' + Date.now(),
      type: 'GENERAL',
      company_id: companyId
    }
  });

  let version = await tenantPrisma.reportFormatVersion.create({
    data: {
      format_id: format.id,
      version_num: 1,
      fields_schema: [
        { name: 'Loom Number', type: 'machine' },
        { name: 'Closing reading', type: 'number' }
      ]
    }
  });

  const versionIds = [version.id];

  try {
    console.log('Inserting mock report entries...');
    
    // Entry 1: Loom 5, Closing 100, entry_date = 2026-06-11
    const e1 = await tenantPrisma.reportEntry.create({
      data: {
        company_id: companyId,
        format_version_id: version.id,
        department_id: dept.id,
        submitted_by: user.id,
        entry_date: new Date('2026-06-11T10:00:00Z'),
        payload: { 'Loom Number': 'Loom 5', 'Closing reading': 100 }
      }
    });

    // Entry 2: Loom 5, Closing 150, entry_date = 2026-06-12 (created first)
    const e2 = await tenantPrisma.reportEntry.create({
      data: {
        company_id: companyId,
        format_version_id: version.id,
        department_id: dept.id,
        submitted_by: user.id,
        entry_date: new Date('2026-06-12T10:00:00Z'),
        payload: { 'Loom Number': 'Loom 5', 'Closing reading': 150 }
      }
    });

    // Entry 3: Loom 5, Closing 200, entry_date = 2026-06-12 (created second, should be latest)
    const e3 = await tenantPrisma.reportEntry.create({
      data: {
        company_id: companyId,
        format_version_id: version.id,
        department_id: dept.id,
        submitted_by: user.id,
        entry_date: new Date('2026-06-12T10:00:00Z'),
        payload: { 'Loom Number': 'Loom 5', 'Closing reading': 200 }
      }
    });

    // Entry 4: Loom 8, Closing 500, entry_date = 2026-06-12
    const e4 = await tenantPrisma.reportEntry.create({
      data: {
        company_id: companyId,
        format_version_id: version.id,
        department_id: dept.id,
        submitted_by: user.id,
        entry_date: new Date('2026-06-12T10:00:00Z'),
        payload: { 'Loom Number': 'Loom 8', 'Closing reading': 500 }
      }
    });

    console.log('Running query checks...');

    // Function to run backend last-value query logic locally
    const getLastValue = async (sourceFieldId: string, scopeFieldId?: string, scopeValue?: any) => {
      const whereClause: any = {
        format_version: { format_id: format.id }
      };

      if (scopeFieldId && scopeValue !== undefined && scopeValue !== null && scopeValue !== '') {
        const stringValue = String(scopeValue);
        const numValue = Number(scopeValue);
        const isNum = !isNaN(numValue);

        const conditions: any[] = [
          {
            payload: {
              path: [scopeFieldId],
              equals: stringValue
            }
          }
        ];

        if (isNum) {
          conditions.push({
            payload: {
              path: [scopeFieldId],
              equals: numValue
            }
          });
        }

        whereClause.OR = conditions;
      }

      const lastEntry = await tenantPrisma.reportEntry.findFirst({
        where: whereClause,
        orderBy: [
          { entry_date: 'desc' },
          { created_at: 'desc' }
        ]
      });

      if (!lastEntry) return null;
      const payload = lastEntry.payload as Record<string, any>;
      return payload ? payload[sourceFieldId] : null;
    };

    // Check 1: Loom 5 Closing reading should be 200
    {
      const val = await getLastValue('Closing reading', 'Loom Number', 'Loom 5');
      if (val === 200) {
        console.log('✓ SUCCESS: Last value for Loom 5 is 200');
      } else {
        console.error(`✗ FAILURE: Expected 200, got ${val}`);
        success = false;
      }
    }

    // Check 2: Loom 8 Closing reading should be 500
    {
      const val = await getLastValue('Closing reading', 'Loom Number', 'Loom 8');
      if (val === 500) {
        console.log('✓ SUCCESS: Last value for Loom 8 is 500');
      } else {
        console.error(`✗ FAILURE: Expected 500, got ${val}`);
        success = false;
      }
    }

    // Check 3: Loom 9 (no records) should be null
    {
      const val = await getLastValue('Closing reading', 'Loom Number', 'Loom 9');
      if (val === null) {
        console.log('✓ SUCCESS: Last value for Loom 9 is null');
      } else {
        console.error(`✗ FAILURE: Expected null, got ${val}`);
        success = false;
      }
    }

    // Teardown test records
    console.log('Cleaning up mock records...');
    await tenantPrisma.reportEntry.deleteMany({
      where: { id: { in: [e1.id, e2.id, e3.id, e4.id] } }
    });

  } catch (err: any) {
    console.error('Test failed with error:', err);
    success = false;
  } finally {
    // Delete format
    await tenantPrisma.reportFormatVersion.deleteMany({ where: { format_id: format.id } });
    await tenantPrisma.reportFormat.delete({ where: { id: format.id } });
  }

  if (success) {
    console.log('\n=========================================');
    console.log('ALL CARRY FORWARD ROUTE TESTS PASSED! 🎉');
    console.log('=========================================');
    process.exit(0);
  } else {
    console.error('\n=========================================');
    console.error('SOME CARRY FORWARD ROUTE TESTS FAILED! ✗');
    console.error('=========================================');
    process.exit(1);
  }
}

runCarryForwardTests();
