import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import http from 'http';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production_32_chars';

function request(options: http.RequestOptions, body?: any): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode || 0,
            data: JSON.parse(data)
          });
        } catch {
          resolve({
            statusCode: res.statusCode || 0,
            data: data
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runCrossRoleTests() {
  console.log('Starting Cross-Role Security Enforcement Tests...');
  let success = true;

  const ownerUrl = process.env.DATABASE_URL || '';
  const connectionString = ownerUrl.replace('-pooler', '');
  
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Setup test data using owner client
    console.log('Setting up test companies, departments, users, and entries...');
    const companyA = await prisma.company.create({
      data: { name: 'Role Test Company A', address: '123 Alpha St' }
    });
    const companyB = await prisma.company.create({
      data: { name: 'Role Test Company B', address: '456 Beta St' }
    });

    const deptX = await prisma.department.create({
      data: { name: 'Dept X', company_id: companyA.id }
    });
    const deptY = await prisma.department.create({
      data: { name: 'Dept Y', company_id: companyA.id }
    });

    const adminUserA = await prisma.user.create({
      data: { email: 'adminA@test.com', role: 'COMPANY_ADMIN', company_id: companyA.id, is_email_verified: true }
    });
    const opsUserA = await prisma.user.create({
      data: { email: 'opsA@test.com', role: 'OPERATIONS', company_id: companyA.id, is_email_verified: true }
    });
    
    // Assign opsUserA to Dept X only
    await prisma.userDepartment.create({
      data: { user_id: opsUserA.id, department_id: deptX.id }
    });

    // Create Report Format under Company A
    const formatA = await prisma.reportFormat.create({
      data: { name: 'Format A', type: 'GENERAL', company_id: companyA.id }
    });
    const versionA = await prisma.reportFormatVersion.create({
      data: { format_id: formatA.id, version_num: 1, fields_schema: [] }
    });

    // Create a valid entry for Dept Y (which opsUserA is NOT assigned to)
    const entryY = await prisma.reportEntry.create({
      data: {
        company_id: companyA.id,
        format_version_id: versionA.id,
        department_id: deptY.id,
        submitted_by: adminUserA.id,
        entry_date: new Date(),
        payload: {}
      }
    });

    // Create a pending item submitted by opsUserA
    const pendingItemA = await prisma.item.create({
      data: {
        name: 'Ops Pending Item',
        company_id: companyA.id,
        status: 'PENDING',
        submitted_by: opsUserA.id
      }
    });

    // Create an entry under Company B
    const formatB = await prisma.reportFormat.create({
      data: { name: 'Format B', type: 'GENERAL', company_id: companyB.id }
    });
    const versionB = await prisma.reportFormatVersion.create({
      data: { format_id: formatB.id, version_num: 1, fields_schema: [] }
    });
    const entryB = await prisma.reportEntry.create({
      data: {
        company_id: companyB.id,
        format_version_id: versionB.id,
        department_id: deptY.id, // using same department ID is fine for company_id check
        submitted_by: adminUserA.id, // using same user ID is fine for company_id check
        entry_date: new Date(),
        payload: {}
      }
    });

    // Sign JWT tokens
    const adminTokenA = jwt.sign({ id: adminUserA.id, role: adminUserA.role, companyId: adminUserA.company_id }, JWT_SECRET);
    const opsTokenA = jwt.sign({ id: opsUserA.id, role: opsUserA.role, companyId: opsUserA.company_id }, JWT_SECRET);
    const badSecretToken = jwt.sign({ id: opsUserA.id, role: opsUserA.role, companyId: opsUserA.company_id }, 'definitely_wrong_secret_key_12345');

    console.log('\n--- Test 1: OPERATIONS user blocks on Admin-only endpoints ---');
    {
      // 1a. User list GET /api/users
      const res1 = await request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/users',
        method: 'GET',
        headers: { Authorization: `Bearer ${opsTokenA}` }
      });
      console.log(`- GET /api/users status: ${res1.statusCode}`);
      if (res1.statusCode === 403) {
        console.log('✓ SUCCESS: OPERATIONS blocked from user management listings.');
      } else {
        console.error('✗ FAILURE: OPERATIONS list users was not blocked!');
        success = false;
      }

      // 1b. Format builder POST /api/reports/formats
      const res2 = await request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/reports/formats',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opsTokenA}`,
          'Content-Type': 'application/json'
        }
      }, { name: 'Ops Format', type: 'GENERAL' });
      console.log(`- POST /api/reports/formats status: ${res2.statusCode}`);
      if (res2.statusCode === 403) {
        console.log('✓ SUCCESS: OPERATIONS blocked from creating report formats.');
      } else {
        console.error('✗ FAILURE: OPERATIONS format creation was not blocked!');
        success = false;
      }

      // 1c. Item approval PATCH /api/items/:id/approve
      const res3 = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/items/${pendingItemA.id}/approve`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${opsTokenA}` }
      });
      console.log(`- PATCH /api/items/:id/approve status: ${res3.statusCode}`);
      if (res3.statusCode === 403) {
        console.log('✓ SUCCESS: OPERATIONS blocked from item approvals.');
      } else {
        console.error('✗ FAILURE: OPERATIONS item approval was not blocked!');
        success = false;
      }
    }

    console.log('\n--- Test 2: OPERATIONS user cannot approve their own item via update ---');
    {
      const res = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/items/${pendingItemA.id}`,
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${opsTokenA}`,
          'Content-Type': 'application/json'
        }
      }, { status: 'ACTIVE' });
      console.log(`- PUT /api/items/:id status: ${res.statusCode}`);
      if (res.statusCode === 403) {
        console.log('✓ SUCCESS: OPERATIONS blocked from updating/activating items.');
      } else {
        console.error('✗ FAILURE: OPERATIONS item update activation was not blocked!');
        success = false;
      }
    }

    console.log('\n--- Test 3: OPERATIONS user assigned to Dept X cannot read Dept Y data ---');
    {
      const res = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/reports/entries?departmentId=${deptY.id}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${opsTokenA}` }
      });
      console.log(`- GET /api/reports/entries?departmentId=Dept-Y status: ${res.statusCode}`);
      console.log(`- Response body:`, res.data);
      if (res.statusCode === 403) {
        console.log('✓ SUCCESS: OPERATIONS blocked from reading entries scoped to an unassigned department.');
      } else {
        console.error('✗ FAILURE: OPERATIONS read unassigned department records was not blocked!');
        success = false;
      }

      // Check single entry fetch GET /entries/:id
      const resDetail = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/reports/entries/${entryY.id}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${opsTokenA}` }
      });
      console.log(`- GET /api/reports/entries/:id (Dept Y entry) status: ${resDetail.statusCode}`);
      if (resDetail.statusCode === 403) {
        console.log('✓ SUCCESS: OPERATIONS blocked from fetching specific entry details for unassigned department.');
      } else {
        console.error('✗ FAILURE: OPERATIONS read specific unassigned department record detail was not blocked!');
        success = false;
      }
    }

    console.log('\n--- Test 4: COMPANY_ADMIN cannot access other company\'s records ---');
    {
      // Company Admin A tries to get Company B's entry (entryB)
      const res = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/reports/entries/${entryB.id}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminTokenA}`,
          'x-tenant-id': companyB.id // Trying to override tenant id
        }
      });
      console.log(`- GET /api/reports/entries/:companyBEntry status: ${res.statusCode}`);
      console.log(`- Response body:`, res.data);

      if (res.statusCode === 404) {
        console.log('✓ SUCCESS: COMPANY_ADMIN query returned 404 Not Found (scoped out of Company B).');
      } else {
        console.error('✗ FAILURE: COMPANY_ADMIN was allowed to read or bypass Company B\'s scope!');
        success = false;
      }
    }

    console.log('\n--- Test 5: JWT signed with wrong secret is rejected ---');
    {
      const res = await request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/reports/formats',
        method: 'GET',
        headers: { Authorization: `Bearer ${badSecretToken}` }
      });
      console.log(`- GET /api/reports/formats (bad secret) status: ${res.statusCode}`);
      if (res.statusCode === 401) {
        console.log('✓ SUCCESS: JWT signed with incorrect secret was rejected with 401.');
      } else {
        console.error('✗ FAILURE: JWT signed with incorrect secret was accepted!');
        success = false;
      }
    }

    // Clean up test records
    console.log('\nCleaning up role test records...');
    await prisma.item.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await prisma.reportEntry.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await prisma.reportFormatVersion.deleteMany({ where: { format_id: { in: [formatA.id, formatB.id] } } });
    await prisma.reportFormat.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await prisma.userDepartment.deleteMany({ where: { user_id: { in: [adminUserA.id, opsUserA.id] } } });
    await prisma.user.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await prisma.department.deleteMany({ where: { company_id: { in: [companyA.id, companyB.id] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    console.log('Cleanup completed.');

  } catch (err) {
    console.error('Test script crashed:', err);
    success = false;
  }

  console.log('\n=========================================');
  if (success) {
    console.log('ALL CROSS-ROLE ENFORCEMENT TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } else {
    console.error('✗ SOME CROSS-ROLE ENFORCEMENT TESTS FAILED!');
    process.exit(1);
  }
}

runCrossRoleTests();
