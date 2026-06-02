import { authenticate } from '../middleware/auth';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

async function runTests() {
  console.log('Starting Scoping Security & Tenant Override Verification Tests...');
  let failed = false;

  // Helper mock request generator
  const createMockReqRes = (token: string | null, headers: Record<string, string> = {}) => {
    const req = {
      headers: {
        authorization: token ? `Bearer ${token}` : undefined,
        ...headers
      }
    } as unknown as Request;

    const res = {
      statusCode: 200,
      body: null as any,
      status(code: number) {
        (this as any).statusCode = code;
        return this;
      },
      json(data: any) {
        (this as any).body = data;
        return this;
      }
    } as unknown as Response;

    const next = (() => {}) as NextFunction;

    return { req, res, next };
  };

  // Generate test tokens
  const superAdminToken = jwt.sign({ id: 'sa-1', role: 'SUPER_ADMIN' }, JWT_SECRET);
  const companyAAdminToken = jwt.sign({ id: 'ca-1', role: 'COMPANY_ADMIN', companyId: 'company-A' }, JWT_SECRET);
  const companyAOpsToken = jwt.sign({ id: 'op-1', role: 'OPERATIONS', companyId: 'company-A' }, JWT_SECRET);

  console.log('\n--- 1. Testing SUPER_ADMIN overrides ---');
  {
    // Test 1a: SUPER_ADMIN accessing Company A
    const { req, res } = createMockReqRes(superAdminToken, { 'x-tenant-id': 'company-A' });
    authenticate(req, res, () => {});
    if (req.tenantId === 'company-A') {
      console.log('✓ SUCCESS: SUPER_ADMIN with x-tenant-id=company-A resolved tenantId to company-A.');
    } else {
      console.error(`✗ FAILURE: SUPER_ADMIN expected tenantId 'company-A', got '${req.tenantId}'`);
      failed = true;
    }

    // Test 1b: SUPER_ADMIN accessing Company B
    const { req: req2, res: res2 } = createMockReqRes(superAdminToken, { 'x-tenant-id': 'company-B' });
    authenticate(req2, res2, () => {});
    if (req2.tenantId === 'company-B') {
      console.log('✓ SUCCESS: SUPER_ADMIN with x-tenant-id=company-B resolved tenantId to company-B.');
    } else {
      console.error(`✗ FAILURE: SUPER_ADMIN expected tenantId 'company-B', got '${req2.tenantId}'`);
      failed = true;
    }
  }

  console.log('\n--- 2. Testing COMPANY_ADMIN header ignoring ---');
  {
    // Test 2a: COMPANY_ADMIN of A sending x-tenant-id=company-B (must be ignored)
    const { req, res } = createMockReqRes(companyAAdminToken, { 'x-tenant-id': 'company-B' });
    authenticate(req, res, () => {});
    if (req.tenantId === 'company-A') {
      console.log('✓ SUCCESS: COMPANY_ADMIN x-tenant-id header was ignored. Scoped strictly to user\'s company-A.');
    } else {
      console.error(`✗ FAILURE: COMPANY_ADMIN x-tenant-id override was honored! Expected tenantId 'company-A', got '${req.tenantId}'`);
      failed = true;
    }

    // Test 2b: COMPANY_ADMIN of A without header
    const { req: req2, res: res2 } = createMockReqRes(companyAAdminToken);
    authenticate(req2, res2, () => {});
    if (req2.tenantId === 'company-A') {
      console.log('✓ SUCCESS: COMPANY_ADMIN standard request resolved tenantId to company-A.');
    } else {
      console.error(`✗ FAILURE: COMPANY_ADMIN standard request expected tenantId 'company-A', got '${req2.tenantId}'`);
      failed = true;
    }
  }

  console.log('\n--- 3. Testing OPERATIONS header ignoring ---');
  {
    // Test 3a: OPERATIONS user of A sending x-tenant-id=company-B (must be ignored)
    const { req, res } = createMockReqRes(companyAOpsToken, { 'x-tenant-id': 'company-B' });
    authenticate(req, res, () => {});
    if (req.tenantId === 'company-A') {
      console.log('✓ SUCCESS: OPERATIONS x-tenant-id header was ignored. Scoped strictly to user\'s company-A.');
    } else {
      console.error(`✗ FAILURE: OPERATIONS x-tenant-id override was honored! Expected tenantId 'company-A', got '${req.tenantId}'`);
      failed = true;
    }

    // Test 3b: OPERATIONS user of A without header
    const { req: req2, res: res2 } = createMockReqRes(companyAOpsToken);
    authenticate(req2, res2, () => {});
    if (req2.tenantId === 'company-A') {
      console.log('✓ SUCCESS: OPERATIONS standard request resolved tenantId to company-A.');
    } else {
      console.error(`✗ FAILURE: OPERATIONS standard request expected tenantId 'company-A', got '${req2.tenantId}'`);
      failed = true;
    }
  }

  console.log('\n=========================================');
  if (failed) {
    console.error('✗ SOME SECURITY MITIGATION TESTS FAILED!');
    console.log('=========================================');
    process.exit(1);
  } else {
    console.log('ALL SCOPING SECURITY TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=========================================');
    process.exit(0);
  }
}

runTests();
