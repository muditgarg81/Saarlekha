import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'async_hooks';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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

const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

const adapter = new PrismaPg(pool);

// Global singleton for NON-tenant queries (auth, super-admin). No RLS wrapping here.
export const prisma = new PrismaClient({ adapter });

// Prevents re-wrapping queries that already run inside an RLS transaction.
const rlsStorage = new AsyncLocalStorage<boolean>();

/**
 * Sets BOTH RLS GUCs in a SINGLE round trip (previously two separate round trips).
 * set_config(..., true) is transaction-local and is discarded on COMMIT/ROLLBACK.
 */
function setTenantContext(
  tx: Prisma.TransactionClient,
  companyId: string,
  role?: string
) {
  return tx.$executeRaw`SELECT
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
export function getTenantPrisma(companyId: string, role?: string) {
  return prisma.$extends({
    client: {
      async $transaction<T>(
        fn: (tx: Prisma.TransactionClient) => Promise<T>,
        options?: {
          maxWait?: number;
          timeout?: number;
          isolationLevel?: Prisma.TransactionIsolationLevel;
        }
      ): Promise<T> {
        if (rlsStorage.getStore()) {
          return prisma.$transaction(fn as any, options as any) as any;
        }
        return prisma.$transaction(async (tx) => {
          await setTenantContext(tx, companyId, role);
          return rlsStorage.run(true, () => fn(tx));
        }, options as any) as any;
      },
    },
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (rlsStorage.getStore()) {
            return query(args);
          }
          return prisma.$transaction(async (tx) => {
            await setTenantContext(tx, companyId, role);
            return rlsStorage.run(true, () => (tx as any)[model][operation](args));
          });
        },
      },
    },
  });
}
