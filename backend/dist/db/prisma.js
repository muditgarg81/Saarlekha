"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.getTenantPrisma = getTenantPrisma;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const async_hooks_1 = require("async_hooks");
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * CREDENTIALS — read this:
 * DATABASE_URL MUST connect as the RLS-enforced application role (e.g. `saarlekha_app`),
 * NOT `neondb_owner`. The owner role has BYPASSRLS, which silently disables every
 * Row-Level Security policy. Put the full connection string (including the app-role
 * password) in the environment. NEVER hardcode credentials in source.
 */
let connectionString = process.env.DATABASE_URL || '';
if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
}
/**
 * Use Neon's direct (unpooled) endpoint. Tenant context below is set with
 * transaction-local GUCs (set_config(..., is_local = true)), reset on COMMIT/ROLLBACK,
 * so a normal pg pool of direct connections is correct. (Behaviour unchanged.)
 * If you ever switch to the pooled endpoint, keep it in TRANSACTION pooling mode.
 */
connectionString = connectionString.replace('-pooler', '');
const pool = new pg_1.default.Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});
const adapter = new adapter_pg_1.PrismaPg(pool);
// Global singleton for NON-tenant queries (auth, super-admin). No RLS wrapping here.
exports.prisma = new client_1.PrismaClient({ adapter });
// Prevents re-wrapping queries that already run inside an RLS transaction.
const rlsStorage = new async_hooks_1.AsyncLocalStorage();
/**
 * Sets BOTH RLS GUCs in a SINGLE round trip (previously two separate round trips).
 * set_config(..., true) is transaction-local and is discarded on COMMIT/ROLLBACK.
 */
function setTenantContext(tx, companyId, role) {
    return tx.$executeRaw `SELECT
    set_config('app.current_tenant_id', ${companyId}, true),
    set_config('app.current_user_role', ${role ?? ''}, true)`;
}
/**
 * Returns a tenant-scoped Prisma client that enforces RLS.
 *
 *  1) BATCH (use for ANY route with >1 query):
 *       await client.$transaction(async (tx) => { ...use tx... });
 *     Tenant context is set ONCE. Use `tx` only inside the callback.
 *
 *  2) STANDALONE — a single `client.model.op()` auto-wraps in one transaction.
 *     Convenient, but pays a full transaction per call; don't fire many back-to-back.
 */
function getTenantPrisma(companyId, role) {
    return exports.prisma.$extends({
        client: {
            async $transaction(fn, options) {
                if (rlsStorage.getStore()) {
                    return exports.prisma.$transaction(fn, options);
                }
                return exports.prisma.$transaction(async (tx) => {
                    await setTenantContext(tx, companyId, role);
                    return rlsStorage.run(true, () => fn(tx));
                }, options);
            },
        },
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    if (rlsStorage.getStore()) {
                        return query(args);
                    }
                    return exports.prisma.$transaction(async (tx) => {
                        await setTenantContext(tx, companyId, role);
                        return rlsStorage.run(true, () => tx[model][operation](args));
                    });
                },
            },
        },
    });
}
