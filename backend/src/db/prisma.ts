import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'async_hooks';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Construct connection URL: use saarlekha_app role to ensure Row-Level Security (RLS) is strictly enforced in PostgreSQL
// (The default neondb_owner user has BYPASSRLS enabled, which prevents RLS policies from filtering its queries)
const rawUrl = process.env.DATABASE_URL || '';
let connectionString = rawUrl.includes('neondb_owner:npg_xNgMoVY29bKA')
  ? rawUrl.replace('neondb_owner:npg_xNgMoVY29bKA', 'saarlekha_app:saarlekha_secure_pass')
  : rawUrl;

connectionString = connectionString.replace('-pooler', '');

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Global singleton for standard queries (e.g. Auth, Super Admin)
export const prisma = new PrismaClient({ adapter });

// AsyncLocalStorage to prevent infinite recursion in RLS transaction wrapping
const rlsStorage = new AsyncLocalStorage<boolean>();

/**
 * Returns a Prisma Client extension that injects the tenant ID into the transaction context.
 * This ensures Row-Level Security (RLS) is enforced at the database level for this request.
 */
export function getTenantPrisma(companyId: string, role?: string) {
  return prisma.$extends({
    client: {
      async $transaction<T>(
        fn: (tx: Prisma.TransactionClient) => Promise<T>,
        options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
      ): Promise<T> {
        if (rlsStorage.getStore()) {
          return prisma.$transaction(fn as any, options as any) as any;
        }
        return prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
          if (role) {
            await tx.$executeRaw`SELECT set_config('app.current_user_role', ${role}, true)`;
          } else {
            await tx.$executeRaw`SELECT set_config('app.current_user_role', '', true)`;
          }
          return rlsStorage.run(true, () => {
            return fn(tx);
          });
        }, options as any) as any;
      }
    },
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // If we are already executing within the transaction block for RLS, bypass wrapping
          if (rlsStorage.getStore()) {
            return query(args);
          }

          // Otherwise, start a transaction, set the tenant ID, and run the query within the transaction
          return prisma.$transaction(async (tx) => {
            // Set the Postgres configuration parameters for this transaction
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
            if (role) {
              await tx.$executeRaw`SELECT set_config('app.current_user_role', ${role}, true)`;
            } else {
              await tx.$executeRaw`SELECT set_config('app.current_user_role', '', true)`;
            }
            
            // Run the operation on the transactional client within the context of AsyncLocalStorage
            return rlsStorage.run(true, () => {
              return (tx as any)[model][operation](args);
            });
          });
        },
      },
    },
  });
}
