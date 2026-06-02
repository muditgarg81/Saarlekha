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
// Construct connection URL: use saarlekha_app role to ensure Row-Level Security (RLS) is strictly enforced in PostgreSQL
// (The default neondb_owner user has BYPASSRLS enabled, which prevents RLS policies from filtering its queries)
const rawUrl = process.env.DATABASE_URL || '';
let connectionString = rawUrl.includes('neondb_owner:npg_xNgMoVY29bKA')
    ? rawUrl.replace('neondb_owner:npg_xNgMoVY29bKA', 'saarlekha_app:saarlekha_secure_pass')
    : rawUrl;
connectionString = connectionString.replace('-pooler', '');
const pool = new pg_1.default.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
// Global singleton for standard queries (e.g. Auth, Super Admin)
exports.prisma = new client_1.PrismaClient({ adapter });
// AsyncLocalStorage to prevent infinite recursion in RLS transaction wrapping
const rlsStorage = new async_hooks_1.AsyncLocalStorage();
/**
 * Returns a Prisma Client extension that injects the tenant ID into the transaction context.
 * This ensures Row-Level Security (RLS) is enforced at the database level for this request.
 */
function getTenantPrisma(companyId, role) {
    return exports.prisma.$extends({
        client: {
            async $transaction(fn, options) {
                if (rlsStorage.getStore()) {
                    return exports.prisma.$transaction(fn, options);
                }
                return exports.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw `SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
                    if (role) {
                        await tx.$executeRaw `SELECT set_config('app.current_user_role', ${role}, true)`;
                    }
                    else {
                        await tx.$executeRaw `SELECT set_config('app.current_user_role', '', true)`;
                    }
                    return rlsStorage.run(true, () => {
                        return fn(tx);
                    });
                }, options);
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
                    return exports.prisma.$transaction(async (tx) => {
                        // Set the Postgres configuration parameters for this transaction
                        await tx.$executeRaw `SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
                        if (role) {
                            await tx.$executeRaw `SELECT set_config('app.current_user_role', ${role}, true)`;
                        }
                        else {
                            await tx.$executeRaw `SELECT set_config('app.current_user_role', '', true)`;
                        }
                        // Run the operation on the transactional client within the context of AsyncLocalStorage
                        return rlsStorage.run(true, () => {
                            return tx[model][operation](args);
                        });
                    });
                },
            },
        },
    });
}
