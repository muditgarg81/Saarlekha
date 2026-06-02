"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
dotenv_1.default.config();
function postRequest(path, body) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        const req = http_1.default.request(options, (res) => {
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
                }
                catch {
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
        req.write(postData);
        req.end();
    });
}
async function runSQLInjectionTests() {
    console.log('Starting SQL Injection Verification Tests...');
    let success = true;
    const ownerUrl = process.env.DATABASE_URL || '';
    const connectionString = ownerUrl.replace('-pooler', '');
    const pool = new pg_1.default.Pool({ connectionString });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    const prisma = new client_1.PrismaClient({ adapter });
    // 1. Direct database parameterized check
    console.log('\n--- 1. Direct DB parameterization validation ---');
    const payloads = [
        "x'); SELECT set_config('app.current_tenant_id','company-B',true);--",
        "'; DROP TABLE \"User\";--",
        "' UNION SELECT null, null, null--"
    ];
    for (const maliciousPayload of payloads) {
        console.log(`Testing payload: "${maliciousPayload}"`);
        try {
            await prisma.$transaction(async (tx) => {
                // Set a baseline current_tenant_id
                await tx.$executeRaw `SELECT set_config('app.current_tenant_id', 'company-A', true)`;
                // Execute the login email set_config using the parameter parameter
                await tx.$executeRaw `SELECT set_config('app.login_email', ${maliciousPayload}, true)`;
                // Query settings
                const tenantRes = await tx.$queryRaw `SELECT current_setting('app.current_tenant_id', true) as val`;
                const emailRes = await tx.$queryRaw `SELECT current_setting('app.login_email', true) as val`;
                const tenantVal = tenantRes[0]?.val;
                const emailVal = emailRes[0]?.val;
                console.log(`- Resolved app.current_tenant_id: "${tenantVal}" (Expected: "company-A")`);
                console.log(`- Resolved app.login_email: "${emailVal}" (Expected: Exact literal payload)`);
                if (tenantVal === 'company-A' && emailVal === maliciousPayload) {
                    console.log('✓ SUCCESS: Parameterized query treated input as literal value. GUC remains unaltered.');
                }
                else {
                    console.error('✗ FAILURE: SQL injection modified GUC state or input was not treated as literal!');
                    success = false;
                }
            });
        }
        catch (err) {
            console.error('✗ FAILURE: Parameterized transaction threw a SQL syntax/execution error:', err.message || err);
            success = false;
        }
    }
    // 2. Integration check on running Auth Endpoints
    console.log('\n--- 2. Integration checks on unauthenticated endpoints (local server) ---');
    for (const maliciousPayload of payloads) {
        console.log(`Sending payload to /api/auth/login and /api/auth/forgot-password: "${maliciousPayload}"`);
        // Test login
        try {
            const loginRes = await postRequest('/api/auth/login', {
                email: maliciousPayload,
                password: 'SomePassword123'
            });
            console.log(`- /api/auth/login response status: ${loginRes.statusCode}`);
            console.log(`- Response payload:`, loginRes.data);
            if (loginRes.statusCode === 401 && loginRes.data?.error === 'Invalid credentials') {
                console.log('✓ SUCCESS: /login handles malicious email as standard literal lookup (unauthorized).');
            }
            else {
                console.error('✗ FAILURE: /login did not return expected invalid credentials format.');
                success = false;
            }
        }
        catch (err) {
            console.error('✗ FAILURE: /login endpoint failed to respond:', err.message);
            success = false;
        }
        // Test forgot-password
        try {
            const forgotRes = await postRequest('/api/auth/forgot-password', {
                email: maliciousPayload
            });
            console.log(`- /api/auth/forgot-password response status: ${forgotRes.statusCode}`);
            console.log(`- Response payload:`, forgotRes.data);
            if (forgotRes.statusCode === 200 && forgotRes.data?.message === 'If that email is registered, we have sent a reset link.') {
                console.log('✓ SUCCESS: /forgot-password handles malicious email as standard literal lookup (ignored gracefully).');
            }
            else {
                console.error('✗ FAILURE: /forgot-password did not return standard response.');
                success = false;
            }
        }
        catch (err) {
            console.error('✗ FAILURE: /forgot-password endpoint failed to respond:', err.message);
            success = false;
        }
    }
    // Cleanup DB connections
    await prisma.$disconnect();
    await pool.end();
    console.log('\n=========================================');
    if (success) {
        console.log('ALL SQL INJECTION PROTECTION TESTS PASSED SUCCESSFULLY! 🎉');
        process.exit(0);
    }
    else {
        console.error('✗ SOME SQL INJECTION PROTECTION TESTS FAILED!');
        process.exit(1);
    }
}
runSQLInjectionTests();
