# Antigravity Task — SaarLekha Dashboard Performance Fix

## Objective
Fix login/data-load latency on the SaarLekha backend by (1) eliminating the
per-query RLS transaction overhead, (2) collapsing the dashboard `/summary` reads
into one transaction, (3) replacing an unpaginated maintenance scan with a single
`DISTINCT ON` query, and (4) adding the missing database indexes. Also remove
hardcoded DB credentials from source.

**The API response shapes MUST NOT change. The frontend is not to be edited.**

---

## GUARDRAILS (do not violate)
1. Do **not** alter the JSON returned by `GET /dashboard/summary` or
   `POST /dashboard/production`. Field names, nesting, and types stay identical.
2. Inside any `$transaction(async (tx) => …)` block, use **only** the `tx` argument
   for queries. Never call the outer `prismaTenant.*` client inside a transaction —
   under RLS it would run on a connection without the tenant GUC and return wrong/empty data.
3. Do **not** hardcode any database credentials, passwords, or connection strings
   in source files. Credentials come only from environment variables.
4. Do **not** attempt to rotate Neon passwords or log into Neon/Railway. That is a
   human step (see "MANUAL STEPS" at the end). Flag it; do not perform it.
5. The raw SQL assumes Prisma default table names (no `@@map`). The current schema
   has no `@@map`/`@map`, so this holds. If that changes, update the quoted identifiers.

---

## TASK 1 — Replace the Prisma client wrapper

Locate the file that currently exports `getTenantPrisma` (expected path:
`backend/src/db/prisma.ts`) and replace its **entire contents** with:

```ts
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
```

If the old file contained literal passwords in a `.replace('neondb_owner:...')`
expression, confirm they are fully gone after this replacement.

---

## TASK 2 — Replace the dashboard router

Locate the dashboard route file (expected path:
`backend/src/routes/dashboard.ts`) and replace its **entire contents** with:

```ts
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { getTenantPrisma } from '../db/prisma';
import { calculateEfficiency } from '../utils/efficiency';

function hasMachineAndOperator(fields: any[]) {
  if (!fields || !Array.isArray(fields)) return false;
  const hasMachine = fields.some((f: any) => {
    const l = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return l.startsWith('machine') || l.startsWith('loom');
  });
  const hasOperator = fields.some((f: any) => {
    const l = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return l.startsWith('operator') || l === 'person' || l === 'staff';
  });
  return hasMachine && hasOperator;
}

function parsePayload(payload: any) {
  if (!payload || typeof payload !== 'object') return null;
  const keys = Object.keys(payload);

  const prodKey = keys.find(k => {
    const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return l.startsWith('production') || l.startsWith('output') || l.startsWith('produced');
  });
  const targetKey = keys.find(k => {
    const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return l.startsWith('target');
  });
  const opKey = keys.find(k => {
    const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return l.startsWith('operator') || l === 'person' || l === 'staff';
  });
  const machineKey = keys.find(k => {
    const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return l.startsWith('machine') || l.startsWith('loom');
  });

  if (!prodKey || !targetKey || !opKey || !machineKey) return null;

  const production = parseFloat(payload[prodKey]);
  const target = parseFloat(payload[targetKey]);

  return {
    operatorName: String(payload[opKey]).trim(),
    machineName: String(payload[machineKey]).trim(),
    production: isNaN(production) ? 0 : production,
    target: isNaN(target) ? 0 : target
  };
}

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/summary', async (req, res) => {
  const tenantId = req.tenantId!;
  const { startDate, endDate, departmentId } = req.query;
  const prismaTenant = getTenantPrisma(tenantId);
  const user = req.user!;

  try {
    let dateFilter: any;
    if (startDate && endDate) {
      const end = new Date(endDate as string);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter = {
        gte: new Date(startDate as string),
        lte: end,
      };
    }

    // ALL reads inside ONE transaction: tenant RLS context set ONCE (1 round trip)
    // instead of once per query. Use `tx` only in here — never prismaTenant.*.
    const raw = await prismaTenant.$transaction(async (tx) => {
      let deptFilter: string[] | undefined;
      if (user.role === 'OPERATIONS') {
        const userDepts = await (tx as any).userDepartment.findMany({
          where: { user_id: user.id },
          select: { department_id: true },
        });
        const allowed = userDepts.map((d: any) => d.department_id);
        if (departmentId) {
          deptFilter = allowed.includes(departmentId as string) ? [departmentId as string] : [];
        } else {
          deptFilter = allowed;
        }
      } else {
        deptFilter = departmentId ? [departmentId as string] : undefined;
      }

      const productionWhere: any = {};
      if (dateFilter) productionWhere.date = dateFilter;
      if (deptFilter) {
        const manpowerInDepts = await (tx as any).manpower.findMany({
          where: { department_id: { in: deptFilter } },
          select: { id: true },
        });
        productionWhere.operator_id = { in: manpowerInDepts.map((m: any) => m.id) };
      }

      const reportEntryWhere: any = {};
      if (dateFilter) reportEntryWhere.entry_date = dateFilter;
      if (deptFilter) reportEntryWhere.department_id = { in: deptFilter };

      const manpowerCount = await (tx as any).manpower.count();
      const openJobOrders = await (tx as any).jobOrder.count({ where: { status: 'OPEN' } });

      const productionRecords = await (tx as any).productionRecord.findMany({
        where: productionWhere,
        include: {
          operator: { select: { id: true, name: true } },
          machine: { select: { id: true, name: true } },
        },
      });

      // Unpaginated by design (used for unsynced fold-in). See follow-up note below.
      const reportEntries = await (tx as any).reportEntry.findMany({
        where: reportEntryWhere,
        include: { format_version: true },
      });

      const machines = await (tx as any).machine.findMany({
        where: deptFilter
          ? { OR: [{ department_id: { in: deptFilter } }, { department_id: null }] }
          : {},
        orderBy: { name: 'asc' },
      });

      // Latest maintenance per machine in ONE bounded query (was: load-all + JS reduce).
      // Assumes default Prisma table names (no @@map).
      const deptCond = deptFilter
        ? Prisma.sql`AND re.department_id = ANY(${deptFilter}::text[])`
        : Prisma.empty;

      const maintenanceRows = await tx.$queryRaw<Array<{
        machine_id: string;
        entry_date: Date;
        maintenance_type: string | null;
        status: string | null;
        department_name: string | null;
      }>>(Prisma.sql`
        SELECT DISTINCT ON (re.payload->>'_machine_id')
          re.payload->>'_machine_id'        AS machine_id,
          re.entry_date                     AS entry_date,
          re.payload->>'_maintenance_type'  AS maintenance_type,
          re.payload->>'_status'            AS status,
          d.name                            AS department_name
        FROM "ReportEntry" re
        JOIN "ReportFormatVersion" rfv ON rfv.id = re.format_version_id
        JOIN "ReportFormat" rf ON rf.id = rfv.format_id
        LEFT JOIN "Department" d ON d.id = re.department_id
        WHERE re.company_id = ${tenantId}
          AND rf."type" = 'MAINTENANCE'
          AND re.payload->>'_machine_id' IS NOT NULL
          ${deptCond}
        ORDER BY re.payload->>'_machine_id', re.entry_date DESC, re.created_at DESC
      `);

      const recentEntries = await (tx as any).reportEntry.findMany({
        where: reportEntryWhere,
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          format_version: { include: { format: { select: { name: true, type: true } } } },
          department: { select: { name: true } },
          submitter: { select: { email: true } },
        },
      });

      return {
        manpowerCount,
        openJobOrders,
        productionRecords,
        reportEntries,
        machines,
        maintenanceRows,
        recentEntries,
      };
    }, { maxWait: 5000, timeout: 20000 });

    // CPU/aggregation OUTSIDE the transaction (no DB connection held).
    const {
      manpowerCount,
      openJobOrders,
      productionRecords,
      reportEntries,
      machines,
      maintenanceRows,
      recentEntries,
    } = raw;

    const machineProdEntries = reportEntries.filter((e: any) => {
      const schema = e.format_version?.fields_schema || [];
      return hasMachineAndOperator(schema);
    });

    const syncedEntryIds = new Set(
      productionRecords.map((r: any) => r.report_entry_id).filter(Boolean)
    );
    const unsyncedParsedEntries = machineProdEntries
      .filter((e: any) => !syncedEntryIds.has(e.id))
      .map((e: any) => parsePayload(e.payload))
      .filter(Boolean) as { operatorName: string; machineName: string; production: number; target: number }[];

    const extraProduction = unsyncedParsedEntries.reduce((sum: number, entry) => sum + entry.production, 0);
    const extraTarget = unsyncedParsedEntries.reduce((sum: number, entry) => sum + entry.target, 0);

    const totalProduction = productionRecords.reduce((sum: number, r: any) => sum + r.production_amount, 0) + extraProduction;
    const totalTarget = productionRecords.reduce((sum: number, r: any) => sum + r.target_amount, 0) + extraTarget;
    const overallEfficiency = calculateEfficiency(totalProduction, totalTarget);

    const operatorMap: Record<string, { name: string; production: number; target: number }> = {};
    for (const r of productionRecords as any[]) {
      const name = r.operator.name.trim();
      const key = name.toLowerCase();
      if (!operatorMap[key]) operatorMap[key] = { name, production: 0, target: 0 };
      operatorMap[key].production += r.production_amount;
      operatorMap[key].target += r.target_amount;
    }
    for (const entry of unsyncedParsedEntries) {
      const name = entry.operatorName;
      const key = name.toLowerCase();
      if (!operatorMap[key]) operatorMap[key] = { name, production: 0, target: 0 };
      operatorMap[key].production += entry.production;
      operatorMap[key].target += entry.target;
    }
    const operatorEfficiency = Object.entries(operatorMap).map(([id, data]) => ({
      id, name: data.name,
      production: data.production,
      target: data.target,
      efficiency: calculateEfficiency(data.production, data.target)
    }));

    const machineMap: Record<string, { name: string; production: number; target: number }> = {};
    for (const r of productionRecords as any[]) {
      const name = r.machine.name.trim();
      const key = name.toLowerCase();
      if (!machineMap[key]) machineMap[key] = { name, production: 0, target: 0 };
      machineMap[key].production += r.production_amount;
      machineMap[key].target += r.target_amount;
    }
    for (const entry of unsyncedParsedEntries) {
      const name = entry.machineName;
      const key = name.toLowerCase();
      if (!machineMap[key]) machineMap[key] = { name, production: 0, target: 0 };
      machineMap[key].production += entry.production;
      machineMap[key].target += entry.target;
    }
    const machineEfficiency = Object.entries(machineMap).map(([id, data]) => ({
      id, name: data.name,
      production: data.production,
      target: data.target,
      efficiency: calculateEfficiency(data.production, data.target)
    }));

    const latestMaintenanceByMachine: Record<string, any> = {};
    for (const row of maintenanceRows) {
      if (row.machine_id && !latestMaintenanceByMachine[row.machine_id]) {
        latestMaintenanceByMachine[row.machine_id] = {
          lastMaintenanceDate: row.entry_date,
          maintenanceType: row.maintenance_type || 'N/A',
          status: row.status || 'completed',
          departmentName: row.department_name || 'N/A',
        };
      }
    }

    const machineMaintenanceSummary = (machines as any[]).map((machine) => {
      const latest = latestMaintenanceByMachine[machine.id];
      return {
        machineId: machine.id,
        machineName: machine.name,
        lastMaintenanceDate: latest ? latest.lastMaintenanceDate : null,
        maintenanceType: latest ? latest.maintenanceType : 'N/A',
        status: latest ? latest.status : 'N/A',
        departmentName: latest ? latest.departmentName : 'N/A'
      };
    });

    res.json({
      kpis: {
        totalProduction,
        totalTarget,
        overallEfficiency,
        manpowerCount,
        openJobOrders,
        recordCount: productionRecords.length,
      },
      operatorEfficiency,
      machineEfficiency,
      machineMaintenanceSummary,
      recentEntries,
      productionRecords,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch dashboard summary', details: error.message });
  }
});

dashboardRouter.post('/production', async (req, res) => {
  const tenantId = req.tenantId!;
  const data = req.body;
  const prismaTenant = getTenantPrisma(tenantId);

  try {
    const record = await prismaTenant.$transaction(async (tx) => {
      let departmentId = data.department_id;

      if (!departmentId) {
        const machine = await (tx as any).machine.findUnique({
          where: { id: data.machine_id },
          select: { department_id: true },
        });
        departmentId = machine?.department_id || undefined;
      }
      if (!departmentId) {
        const operator = await (tx as any).manpower.findUnique({
          where: { id: data.operator_id },
          select: { department_id: true },
        });
        departmentId = operator?.department_id || undefined;
      }
      if (!departmentId) {
        const err: any = new Error('Department ID is required and could not be resolved from machine or operator.');
        err.statusCode = 400;
        throw err;
      }

      return (tx as any).productionRecord.create({
        data: {
          company_id: tenantId,
          date: new Date(data.date),
          production_amount: parseFloat(data.production_amount),
          target_amount: parseFloat(data.target_amount),
          operator_id: data.operator_id,
          machine_id: data.machine_id,
          department_id: departmentId,
        },
      });
    });

    res.status(201).json(record);
  } catch (error: any) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to log production', details: error.message });
  }
});
```

---

## TASK 3 — Add indexes to the Prisma schema

In `backend/prisma/schema.prisma`, add these `@@index` lines to the matching
models (keep existing fields/relations untouched):

```prisma
model ReportEntry {
  // ...existing fields...
  @@index([company_id, entry_date])
  @@index([department_id])
  @@index([format_version_id])
}
model ProductionRecord {
  // ...
  @@index([company_id, date])
  @@index([operator_id])
  @@index([machine_id])
}
model Manpower {
  // ...
  @@index([company_id])
  @@index([department_id])
}
model JobOrder {
  // ...
  @@index([company_id, status])
  @@index([customer_id])
}
model Machine {
  // ...
  @@index([company_id])
  @@index([department_id])
}
model ReportFormatVersion {
  // ...
  @@index([format_id])
}
model ReportFormat {
  // ...
  @@index([company_id, type])
}
model Customer {
  // ...
  @@index([company_id])
}
model AuditLogEntry {
  // ...
  @@index([company_id, timestamp])
}
```

Then generate and apply the migration:
```
npx prisma migrate dev --name perf_indexes
```
(If you cannot run an interactive migration in this environment, instead run the
equivalent raw SQL in TASK 3b against the database.)

### TASK 3b — Raw SQL fallback (only if not using prisma migrate)
Create `backend/prisma/manual/add_performance_indexes.sql` with:

```sql
CREATE INDEX IF NOT EXISTS "ReportEntry_company_id_entry_date_idx" ON "ReportEntry" ("company_id", "entry_date");
CREATE INDEX IF NOT EXISTS "ReportEntry_department_id_idx"          ON "ReportEntry" ("department_id");
CREATE INDEX IF NOT EXISTS "ReportEntry_format_version_id_idx"      ON "ReportEntry" ("format_version_id");
CREATE INDEX IF NOT EXISTS "ProductionRecord_company_id_date_idx"   ON "ProductionRecord" ("company_id", "date");
CREATE INDEX IF NOT EXISTS "ProductionRecord_operator_id_idx"       ON "ProductionRecord" ("operator_id");
CREATE INDEX IF NOT EXISTS "ProductionRecord_machine_id_idx"        ON "ProductionRecord" ("machine_id");
CREATE INDEX IF NOT EXISTS "Manpower_company_id_idx"                ON "Manpower" ("company_id");
CREATE INDEX IF NOT EXISTS "Manpower_department_id_idx"             ON "Manpower" ("department_id");
CREATE INDEX IF NOT EXISTS "JobOrder_company_id_status_idx"         ON "JobOrder" ("company_id", "status");
CREATE INDEX IF NOT EXISTS "JobOrder_customer_id_idx"               ON "JobOrder" ("customer_id");
CREATE INDEX IF NOT EXISTS "Machine_company_id_idx"                 ON "Machine" ("company_id");
CREATE INDEX IF NOT EXISTS "Machine_department_id_idx"              ON "Machine" ("department_id");
CREATE INDEX IF NOT EXISTS "ReportFormatVersion_format_id_idx"      ON "ReportFormatVersion" ("format_id");
CREATE INDEX IF NOT EXISTS "ReportFormat_company_id_type_idx"       ON "ReportFormat" ("company_id", "type");
CREATE INDEX IF NOT EXISTS "Customer_company_id_idx"                ON "Customer" ("company_id");
CREATE INDEX IF NOT EXISTS "AuditLogEntry_company_id_timestamp_idx" ON "AuditLogEntry" ("company_id", "timestamp");
```

---

## TASK 4 — De-secret the codebase
1. Search the whole repo for the leaked literals (e.g. `npg_`, `saarlekha_secure_pass`,
   `neondb_owner:`). Confirm none remain in source after TASK 1.
2. Add/ensure `.env.example` documents the required vars with placeholders only:
   ```
   DATABASE_URL=postgresql://saarlekha_app:__SET_IN_ENV__@<host>/<db>?sslmode=require
   PG_POOL_MAX=10
   ```
3. Ensure `.env` is gitignored. Do NOT write any real password anywhere in the repo.

---

## ACCEPTANCE CRITERIA
- TypeScript compiles; the backend builds and starts.
- `GET /dashboard/summary` returns the same JSON structure as before (kpis,
  operatorEfficiency, machineEfficiency, machineMaintenanceSummary, recentEntries,
  productionRecords). `POST /dashboard/production` still returns 201 with the record
  and 400 when department cannot be resolved.
- No database credentials remain anywhere in source.
- Indexes exist (verify with `\d "ReportEntry"` etc., or that the migration applied).
- (Optional) `EXPLAIN ANALYZE` on a `/summary` query shows index scans, not seq scans,
  on the `company_id`/date predicates once data is present.

---

## MANUAL STEPS (human — Antigravity must NOT do these)
1. In the Neon console, reset the `saarlekha_app` (and `neondb_owner` if it was
   exposed) passwords. Treat the previously hardcoded passwords as compromised.
2. Set `DATABASE_URL` (and optional `PG_POOL_MAX`) in the Railway service env and in
   local `.env`, using the `saarlekha_app` role + the new password. Redeploy.
3. (Optional, for login cold-start latency) enable a keep-warm ping or a
   non-suspending Neon compute tier; confirm the API container is not CPU-throttled.

---

## FOLLOW-UP (do NOT implement now — separate task)
`/summary` still loads all in-range `ReportEntry` rows and re-parses their JSON
payloads to fold in "unsynced" production. The durable fix is to materialize a
`ProductionRecord` when a report entry is submitted (write-time sync), so the
dashboard reads only aggregates. This touches the report-submission path and
should be scoped and reviewed on its own.
