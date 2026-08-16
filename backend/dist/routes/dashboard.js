"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../db/prisma");
const efficiency_1 = require("../utils/efficiency");
function hasMachineAndOperator(fields) {
    if (!fields || !Array.isArray(fields))
        return false;
    const hasMachine = fields.some((f) => {
        const l = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return l.startsWith('machine') || l.startsWith('loom');
    });
    const hasOperator = fields.some((f) => {
        const l = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return l.startsWith('operator') || l === 'person' || l === 'staff';
    });
    return hasMachine && hasOperator;
}
function parsePayload(payload) {
    if (!payload || typeof payload !== 'object')
        return null;
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
    if (!prodKey || !targetKey || !opKey || !machineKey)
        return null;
    const production = parseFloat(payload[prodKey]);
    const target = parseFloat(payload[targetKey]);
    return {
        operatorName: String(payload[opKey]).trim(),
        machineName: String(payload[machineKey]).trim(),
        production: isNaN(production) ? 0 : production,
        target: isNaN(target) ? 0 : target
    };
}
exports.dashboardRouter = (0, express_1.Router)();
exports.dashboardRouter.use(auth_1.authenticate);
exports.dashboardRouter.get('/summary', async (req, res) => {
    const tenantId = req.tenantId;
    const { startDate, endDate, departmentId } = req.query;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    const user = req.user;
    try {
        let startDt;
        let endDt;
        if (startDate && endDate) {
            startDt = new Date(startDate);
            endDt = new Date(endDate);
            endDt.setUTCHours(23, 59, 59, 999);
        }
        const raw = await prismaTenant.$transaction(async (tx) => {
            // Resolve department filter
            let deptFilter;
            if (user.role === 'OPERATIONS') {
                const userDepts = await tx.userDepartment.findMany({
                    where: { user_id: user.id },
                    select: { department_id: true },
                });
                const allowed = userDepts.map((d) => d.department_id);
                if (departmentId) {
                    deptFilter = allowed.includes(departmentId) ? [departmentId] : [];
                }
                else {
                    deptFilter = allowed;
                }
            }
            else {
                deptFilter = departmentId ? [departmentId] : undefined;
            }
            // Backfill missing department_id on ProductionRecord if null
            await tx.$executeRaw `
        UPDATE "ProductionRecord" pr
        SET department_id = COALESCE(m.department_id, mc.department_id)
        FROM "Manpower" m, "Machine" mc
        WHERE pr.operator_id = m.id AND pr.machine_id = mc.id AND pr.department_id IS NULL
      `;
            // SQL condition fragments — used in $queryRaw calls below.
            // prDeptCond: filter production records by operator's or machine's or record's department membership.
            const prDateCond = startDt && endDt
                ? client_1.Prisma.sql `AND pr.date >= ${startDt} AND pr.date <= ${endDt}`
                : client_1.Prisma.empty;
            const prDeptCond = deptFilter
                ? client_1.Prisma.sql `AND COALESCE(pr.department_id, m.department_id, mc.department_id) = ANY(${deptFilter}::text[])`
                : client_1.Prisma.empty;
            const reDeptCond = deptFilter
                ? client_1.Prisma.sql `AND re.department_id = ANY(${deptFilter}::text[])`
                : client_1.Prisma.empty;
            const maintenanceDeptCond = deptFilter
                ? client_1.Prisma.sql `AND re.department_id = ANY(${deptFilter}::text[])`
                : client_1.Prisma.empty;
            // Scalar counts
            const manpowerCount = await tx.manpower.count();
            const openJobOrders = await tx.jobOrder.count({ where: { status: 'OPEN' } });
            const reportFormatsCount = await tx.reportFormat.count();
            const allDepts = await tx.department.findMany({
                where: deptFilter ? { id: { in: deptFilter } } : {},
                orderBy: { name: 'asc' },
            });
            // --- SQL aggregations replace the raw productionRecord.findMany() ---
            // These return only summary rows (O(operators/machines/days)) instead of
            // fetching every individual record across the wire from Neon to Render.
            const globalTotalsRows = await tx.$queryRaw `
        SELECT
          COALESCE(SUM(pr.production_amount), 0)::float AS total_production,
          COALESCE(SUM(pr.target_amount), 0)::float     AS total_target,
          COUNT(*)::bigint                              AS record_count
        FROM "ProductionRecord" pr
        JOIN "Manpower" m ON m.id = pr.operator_id
        LEFT JOIN "Machine" mc ON mc.id = pr.machine_id
        WHERE 1=1 ${prDateCond} ${prDeptCond}
      `;
            const dailyAggs = await tx.$queryRaw `
        SELECT
          TO_CHAR(DATE(pr.date), 'YYYY-MM-DD') AS day,
          SUM(pr.production_amount)::float      AS production,
          SUM(pr.target_amount)::float          AS target
        FROM "ProductionRecord" pr
        JOIN "Manpower" m ON m.id = pr.operator_id
        LEFT JOIN "Machine" mc ON mc.id = pr.machine_id
        WHERE 1=1 ${prDateCond} ${prDeptCond}
        GROUP BY DATE(pr.date)
        ORDER BY DATE(pr.date)
      `;
            const operatorAggs = await tx.$queryRaw `
        SELECT m.id, m.name,
          SUM(pr.production_amount)::float AS production,
          SUM(pr.target_amount)::float     AS target
        FROM "ProductionRecord" pr
        JOIN "Manpower" m ON m.id = pr.operator_id
        LEFT JOIN "Machine" mc ON mc.id = pr.machine_id
        WHERE 1=1 ${prDateCond} ${prDeptCond}
        GROUP BY m.id, m.name
      `;
            const machineAggs = await tx.$queryRaw `
        SELECT mc.id, mc.name,
          SUM(pr.production_amount)::float AS production,
          SUM(pr.target_amount)::float     AS target
        FROM "ProductionRecord" pr
        JOIN "Machine" mc ON mc.id = pr.machine_id
        LEFT JOIN "Manpower" m ON m.id = pr.operator_id
        WHERE 1=1 ${prDateCond} ${prDeptCond}
        GROUP BY mc.id, mc.name
      `;
            // Per-department operator aggregates.
            const deptOperatorAggs = await tx.$queryRaw `
        SELECT COALESCE(pr.department_id, m.department_id, mc.department_id) AS dept_id, m.id, m.name,
          SUM(pr.production_amount)::float AS production,
          SUM(pr.target_amount)::float     AS target
        FROM "ProductionRecord" pr
        JOIN "Manpower" m ON m.id = pr.operator_id
        LEFT JOIN "Machine" mc ON mc.id = pr.machine_id
        WHERE 1=1 ${prDateCond} ${prDeptCond}
          AND COALESCE(pr.department_id, m.department_id, mc.department_id) IS NOT NULL
        GROUP BY COALESCE(pr.department_id, m.department_id, mc.department_id), m.id, m.name
      `;
            // Per-department machine aggregates.
            const deptMachineAggs = await tx.$queryRaw `
        WITH raw AS (
          SELECT COALESCE(pr.department_id, mc.department_id, m.department_id) AS dept_id, mc.id, mc.name,
            pr.production_amount AS prod, pr.target_amount AS tgt
          FROM "ProductionRecord" pr
          JOIN "Machine" mc ON mc.id = pr.machine_id
          LEFT JOIN "Manpower" m ON m.id = pr.operator_id
          WHERE 1=1 ${prDateCond} ${prDeptCond}
            AND COALESCE(pr.department_id, mc.department_id, m.department_id) IS NOT NULL
        )
        SELECT dept_id, id, name,
          SUM(prod)::float AS production,
          SUM(tgt)::float  AS target
        FROM raw
        GROUP BY dept_id, id, name
      `;
            // Synced report entry IDs (those already represented in ProductionRecord).
            const syncedIdsRows = await tx.$queryRaw `
        SELECT report_entry_id AS id
        FROM "ProductionRecord" pr
        JOIN "Manpower" m ON m.id = pr.operator_id
        LEFT JOIN "Machine" mc ON mc.id = pr.machine_id
        WHERE report_entry_id IS NOT NULL
          ${prDateCond} ${prDeptCond}
      `;
            const syncedEntryIds = new Set(syncedIdsRows.map((r) => r.id));
            // Fetch format version schemas (small set — O(formats), not O(entries)).
            // Used to determine which entry formats carry machine+operator fields.
            const allFormatVersions = await tx.reportFormatVersion.findMany({
                select: { id: true, fields_schema: true },
            });
            const qualifyingVersionIds = allFormatVersions
                .filter((v) => hasMachineAndOperator(v.fields_schema))
                .map((v) => v.id);
            // Fetch only unsynced entries for qualifying formats, with minimal columns
            // (no format_version JOIN — schema already known from allFormatVersions above).
            let unsyncedEntries = [];
            if (qualifyingVersionIds.length > 0) {
                const unsyncedWhere = {
                    format_version_id: { in: qualifyingVersionIds },
                    id: { notIn: Array.from(syncedEntryIds) },
                };
                if (startDt && endDt)
                    unsyncedWhere.entry_date = { gte: startDt, lte: endDt };
                if (deptFilter)
                    unsyncedWhere.department_id = { in: deptFilter };
                unsyncedEntries = await tx.reportEntry.findMany({
                    where: unsyncedWhere,
                    select: { id: true, payload: true, department_id: true },
                });
            }
            const machines = await tx.machine.findMany({
                where: deptFilter
                    ? { OR: [{ department_id: { in: deptFilter } }, { department_id: null }] }
                    : {},
                orderBy: { name: 'asc' },
            });
            const maintenanceRows = await tx.$queryRaw(client_1.Prisma.sql `
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
          ${maintenanceDeptCond}
        ORDER BY re.payload->>'_machine_id', re.entry_date DESC, re.created_at DESC
      `);
            const recentEntriesWhere = {};
            if (startDt && endDt)
                recentEntriesWhere.entry_date = { gte: startDt, lte: endDt };
            if (deptFilter)
                recentEntriesWhere.department_id = { in: deptFilter };
            const recentEntries = await tx.reportEntry.findMany({
                where: recentEntriesWhere,
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
                reportFormatsCount,
                allDepts,
                globalTotals: globalTotalsRows[0],
                dailyAggs,
                operatorAggs,
                machineAggs,
                deptOperatorAggs,
                deptMachineAggs,
                unsyncedEntries,
                machines,
                maintenanceRows,
                recentEntries,
            };
        }, { maxWait: 5000, timeout: 30000 });
        const { manpowerCount, openJobOrders, reportFormatsCount, allDepts, globalTotals, dailyAggs, operatorAggs, machineAggs, deptOperatorAggs, deptMachineAggs, unsyncedEntries, machines, maintenanceRows, recentEntries, } = raw;
        // Parse unsynced report entries
        const unsyncedParsedEntries = unsyncedEntries
            .map((e) => {
            const parsed = parsePayload(e.payload);
            return parsed ? { ...parsed, departmentId: e.department_id } : null;
        })
            .filter(Boolean);
        // Global totals (structured records + unsynced parsed entries)
        const extraProduction = unsyncedParsedEntries.reduce((s, e) => s + e.production, 0);
        const extraTarget = unsyncedParsedEntries.reduce((s, e) => s + e.target, 0);
        const totalProduction = Number(globalTotals?.total_production ?? 0) + extraProduction;
        const totalTarget = Number(globalTotals?.total_target ?? 0) + extraTarget;
        const overallEfficiency = (0, efficiency_1.calculateEfficiency)(totalProduction, totalTarget);
        const recordCount = Number(globalTotals?.record_count ?? 0);
        // Shared aggregator: merges SQL aggregate rows + parsed unsynced entries.
        function buildEfficiencyFromAggs(aggs, parsedEntries) {
            const map = {};
            for (const row of aggs) {
                const key = row.name.trim().toLowerCase();
                if (!map[key])
                    map[key] = { name: row.name.trim(), production: 0, target: 0 };
                map[key].production += Number(row.production);
                map[key].target += Number(row.target);
            }
            for (const entry of parsedEntries) {
                const key = entry.name.toLowerCase();
                if (!map[key])
                    map[key] = { name: entry.name, production: 0, target: 0 };
                map[key].production += entry.production;
                map[key].target += entry.target;
            }
            return Object.entries(map).map(([id, data]) => ({
                id,
                name: data.name,
                production: data.production,
                target: data.target,
                efficiency: (0, efficiency_1.calculateEfficiency)(data.production, data.target),
            }));
        }
        const operatorEfficiency = buildEfficiencyFromAggs(operatorAggs, unsyncedParsedEntries.map(e => ({ name: e.operatorName, production: e.production, target: e.target })));
        const machineEfficiency = buildEfficiencyFromAggs(machineAggs, unsyncedParsedEntries.map(e => ({ name: e.machineName, production: e.production, target: e.target })));
        // Build maintenance lookup
        const latestMaintenanceByMachine = {};
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
        const machineMaintenanceSummary = machines.map((machine) => {
            const latest = latestMaintenanceByMachine[machine.id];
            return {
                machineId: machine.id,
                machineName: machine.name,
                lastMaintenanceDate: latest?.lastMaintenanceDate ?? null,
                maintenanceType: latest?.maintenanceType ?? 'N/A',
                status: latest?.status ?? 'N/A',
                departmentName: latest?.departmentName ?? 'N/A',
            };
        });
        // Index per-dept SQL agg rows by dept_id for O(1) lookup per department
        const deptOperatorMap = new Map();
        for (const row of deptOperatorAggs) {
            if (!deptOperatorMap.has(row.dept_id))
                deptOperatorMap.set(row.dept_id, []);
            deptOperatorMap.get(row.dept_id).push({ id: row.id, name: row.name, production: Number(row.production), target: Number(row.target) });
        }
        const deptMachineMap = new Map();
        for (const row of deptMachineAggs) {
            if (!deptMachineMap.has(row.dept_id))
                deptMachineMap.set(row.dept_id, []);
            deptMachineMap.get(row.dept_id).push({ id: row.id, name: row.name, production: Number(row.production), target: Number(row.target) });
        }
        const machinesByDept = new Map();
        for (const m of machines) {
            if (!m.department_id)
                continue;
            if (!machinesByDept.has(m.department_id))
                machinesByDept.set(m.department_id, []);
            machinesByDept.get(m.department_id).push(m);
        }
        const unsyncedEntriesByDept = new Map();
        for (const entry of unsyncedParsedEntries) {
            if (!entry.departmentId)
                continue;
            if (!unsyncedEntriesByDept.has(entry.departmentId))
                unsyncedEntriesByDept.set(entry.departmentId, []);
            unsyncedEntriesByDept.get(entry.departmentId).push(entry);
        }
        // Daily trend (pre-aggregated from SQL — no raw record scan on the frontend)
        const dailyData = dailyAggs.map((r) => ({
            dateStr: r.day,
            production: Number(r.production),
            target: Number(r.target),
        }));
        const departmentsSummary = allDepts.map((dept) => {
            const deptOpRows = deptOperatorMap.get(dept.id) ?? [];
            const deptMcRows = deptMachineMap.get(dept.id) ?? [];
            const deptUnsyncedEntries = unsyncedEntriesByDept.get(dept.id) ?? [];
            const deptMachines = machinesByDept.get(dept.id) ?? [];
            const deptExtraProduction = deptUnsyncedEntries.reduce((s, e) => s + e.production, 0);
            const deptExtraTarget = deptUnsyncedEntries.reduce((s, e) => s + e.target, 0);
            const deptTotalProduction = deptOpRows.reduce((s, r) => s + r.production, 0) + deptExtraProduction;
            const deptTotalTarget = deptOpRows.reduce((s, r) => s + r.target, 0) + deptExtraTarget;
            const deptOperatorEfficiency = buildEfficiencyFromAggs(deptOpRows, deptUnsyncedEntries.map(e => ({ name: e.operatorName, production: e.production, target: e.target })));
            const deptMachineEfficiency = buildEfficiencyFromAggs(deptMcRows, deptUnsyncedEntries.map(e => ({ name: e.machineName, production: e.production, target: e.target })));
            const deptMachineMaintenanceSummary = deptMachines.map((machine) => {
                const latest = latestMaintenanceByMachine[machine.id];
                return {
                    machineId: machine.id,
                    machineName: machine.name,
                    lastMaintenanceDate: latest?.lastMaintenanceDate ?? null,
                    maintenanceType: latest?.maintenanceType ?? 'N/A',
                    status: latest?.status ?? 'N/A',
                    departmentName: latest?.departmentName ?? 'N/A',
                };
            });
            return {
                departmentId: dept.id,
                departmentName: dept.name,
                kpis: {
                    totalProduction: deptTotalProduction,
                    totalTarget: deptTotalTarget,
                    overallEfficiency: (0, efficiency_1.calculateEfficiency)(deptTotalProduction, deptTotalTarget),
                },
                operatorEfficiency: deptOperatorEfficiency,
                machineEfficiency: deptMachineEfficiency,
                machineMaintenanceSummary: deptMachineMaintenanceSummary,
                dailyData: [],
            };
        });
        res.json({
            kpis: {
                totalProduction,
                totalTarget,
                overallEfficiency,
                manpowerCount,
                openJobOrders,
                recordCount,
                reportFormatsCount,
            },
            operatorEfficiency,
            machineEfficiency,
            machineMaintenanceSummary,
            recentEntries,
            dailyData,
            departmentsSummary,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch dashboard summary', details: error.message });
    }
});
exports.dashboardRouter.post('/production', async (req, res) => {
    const tenantId = req.tenantId;
    const data = req.body;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const record = await prismaTenant.$transaction(async (tx) => {
            let departmentId = data.department_id;
            if (!departmentId) {
                const machine = await tx.machine.findUnique({
                    where: { id: data.machine_id },
                    select: { department_id: true },
                });
                departmentId = machine?.department_id || undefined;
            }
            if (!departmentId) {
                const operator = await tx.manpower.findUnique({
                    where: { id: data.operator_id },
                    select: { department_id: true },
                });
                departmentId = operator?.department_id || undefined;
            }
            if (!departmentId) {
                const err = new Error('Department ID is required and could not be resolved from machine or operator.');
                err.statusCode = 400;
                throw err;
            }
            return tx.productionRecord.create({
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
    }
    catch (error) {
        if (error?.statusCode === 400) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to log production', details: error.message });
    }
});
