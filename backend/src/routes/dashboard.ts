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

    // ALL reads inside ONE transaction: tenant RLS context set ONCE
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
      const reportFormatsCount = await (tx as any).reportFormat.count();

      const allDepts = await (tx as any).department.findMany({
        where: deptFilter ? { id: { in: deptFilter } } : {},
        orderBy: { name: 'asc' }
      });

      const productionRecords = await (tx as any).productionRecord.findMany({
        where: productionWhere,
        include: {
          operator: { select: { id: true, name: true } },
          machine: { select: { id: true, name: true, department_id: true } },
        },
      });

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
        reportFormatsCount,
        allDepts,
        productionRecords,
        reportEntries,
        machines,
        maintenanceRows,
        recentEntries,
      };
    }, { maxWait: 5000, timeout: 20000 });

    const {
      manpowerCount,
      openJobOrders,
      reportFormatsCount,
      allDepts,
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
    // Keep each parsed entry's source department_id so per-department buckets
    // can be built in a single pass instead of re-filtering/re-parsing per department.
    const unsyncedParsedEntries = machineProdEntries
      .filter((e: any) => !syncedEntryIds.has(e.id))
      .map((e: any) => {
        const parsed = parsePayload(e.payload);
        return parsed ? { ...parsed, departmentId: e.department_id as string | null } : null;
      })
      .filter(Boolean) as { operatorName: string; machineName: string; production: number; target: number; departmentId: string | null }[];

    const extraProduction = unsyncedParsedEntries.reduce((sum: number, entry) => sum + entry.production, 0);
    const extraTarget = unsyncedParsedEntries.reduce((sum: number, entry) => sum + entry.target, 0);

    const totalProduction = productionRecords.reduce((sum: number, r: any) => sum + r.production_amount, 0) + extraProduction;
    const totalTarget = productionRecords.reduce((sum: number, r: any) => sum + r.target_amount, 0) + extraTarget;
    const overallEfficiency = calculateEfficiency(totalProduction, totalTarget);

    // Shared aggregator: groups structured production records + parsed unsynced
    // entries by trimmed, case-insensitive name. Used for both the global totals
    // and every per-department bucket below (same logic, no behavior change).
    function buildEfficiencyList(
      records: any[],
      getRecordName: (r: any) => string,
      parsedEntries: { name: string; production: number; target: number }[]
    ) {
      const map: Record<string, { name: string; production: number; target: number }> = {};
      for (const r of records) {
        const name = getRecordName(r).trim();
        const key = name.toLowerCase();
        if (!map[key]) map[key] = { name, production: 0, target: 0 };
        map[key].production += r.production_amount;
        map[key].target += r.target_amount;
      }
      for (const entry of parsedEntries) {
        const name = entry.name;
        const key = name.toLowerCase();
        if (!map[key]) map[key] = { name, production: 0, target: 0 };
        map[key].production += entry.production;
        map[key].target += entry.target;
      }
      return Object.entries(map).map(([id, data]) => ({
        id, name: data.name,
        production: data.production,
        target: data.target,
        efficiency: calculateEfficiency(data.production, data.target)
      }));
    }

    const operatorEfficiency = buildEfficiencyList(
      productionRecords,
      (r: any) => r.operator.name,
      unsyncedParsedEntries.map(e => ({ name: e.operatorName, production: e.production, target: e.target }))
    );

    const machineEfficiency = buildEfficiencyList(
      productionRecords,
      (r: any) => r.machine.name,
      unsyncedParsedEntries.map(e => ({ name: e.machineName, production: e.production, target: e.target }))
    );

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

    // Single-pass bucketing replaces the old O(n*m) approach of re-filtering
    // the full productionRecords/reportEntries/maintenanceRows arrays once per
    // department. Each record/entry/machine is now placed into its department
    // bucket(s) exactly once, then departmentsSummary below does O(records-in-dept)
    // work per department instead of O(total-records) — matching the original
    // filter semantics (a production record counts for a department if either
    // its own department_id or its machine's department_id matches).
    const productionRecordsByDept = new Map<string, any[]>();
    for (const r of productionRecords as any[]) {
      const deptIds = new Set<string>();
      if (r.department_id) deptIds.add(r.department_id);
      if (r.machine?.department_id) deptIds.add(r.machine.department_id);
      for (const id of deptIds) {
        if (!productionRecordsByDept.has(id)) productionRecordsByDept.set(id, []);
        productionRecordsByDept.get(id)!.push(r);
      }
    }

    const unsyncedEntriesByDept = new Map<string, typeof unsyncedParsedEntries>();
    for (const entry of unsyncedParsedEntries) {
      if (!entry.departmentId) continue;
      if (!unsyncedEntriesByDept.has(entry.departmentId)) unsyncedEntriesByDept.set(entry.departmentId, []);
      unsyncedEntriesByDept.get(entry.departmentId)!.push(entry);
    }

    const machinesByDept = new Map<string, any[]>();
    for (const m of machines as any[]) {
      if (!m.department_id) continue;
      if (!machinesByDept.has(m.department_id)) machinesByDept.set(m.department_id, []);
      machinesByDept.get(m.department_id)!.push(m);
    }

    const dailyDataMap: Record<string, { dateStr: string; production: number; target: number }> = {};
    for (const r of productionRecords as any[]) {
      const dStr = new Date(r.date).toISOString().split('T')[0];
      if (!dailyDataMap[dStr]) dailyDataMap[dStr] = { dateStr: dStr, production: 0, target: 0 };
      dailyDataMap[dStr].production += r.production_amount;
      dailyDataMap[dStr].target += r.target_amount;
    }
    const dailyData = Object.values(dailyDataMap).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    const departmentsSummary = allDepts.map((dept: any) => {
      const deptProductionRecords = productionRecordsByDept.get(dept.id) || [];
      const deptUnsyncedParsedEntries = unsyncedEntriesByDept.get(dept.id) || [];
      const deptMachines = machinesByDept.get(dept.id) || [];

      const deptExtraProduction = deptUnsyncedParsedEntries.reduce((sum: number, entry) => sum + entry.production, 0);
      const deptExtraTarget = deptUnsyncedParsedEntries.reduce((sum: number, entry) => sum + entry.target, 0);

      const deptTotalProduction = deptProductionRecords.reduce((sum: number, r: any) => sum + r.production_amount, 0) + deptExtraProduction;
      const deptTotalTarget = deptProductionRecords.reduce((sum: number, r: any) => sum + r.target_amount, 0) + deptExtraTarget;
      const deptOverallEfficiency = calculateEfficiency(deptTotalProduction, deptTotalTarget);

      const deptOperatorEfficiency = buildEfficiencyList(
        deptProductionRecords,
        (r: any) => r.operator.name,
        deptUnsyncedParsedEntries.map(e => ({ name: e.operatorName, production: e.production, target: e.target }))
      );

      const deptMachineEfficiency = buildEfficiencyList(
        deptProductionRecords,
        (r: any) => r.machine.name,
        deptUnsyncedParsedEntries.map(e => ({ name: e.machineName, production: e.production, target: e.target }))
      );

      const deptMachineMaintenanceSummary = deptMachines.map((machine: any) => {
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

      const deptDailyDataMap: Record<string, { dateStr: string; production: number; target: number }> = {};
      for (const r of deptProductionRecords) {
        const dStr = new Date(r.date).toISOString().split('T')[0];
        if (!deptDailyDataMap[dStr]) deptDailyDataMap[dStr] = { dateStr: dStr, production: 0, target: 0 };
        deptDailyDataMap[dStr].production += r.production_amount;
        deptDailyDataMap[dStr].target += r.target_amount;
      }
      const deptDailyData = Object.values(deptDailyDataMap).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        kpis: {
          totalProduction: deptTotalProduction,
          totalTarget: deptTotalTarget,
          overallEfficiency: deptOverallEfficiency
        },
        operatorEfficiency: deptOperatorEfficiency,
        machineEfficiency: deptMachineEfficiency,
        machineMaintenanceSummary: deptMachineMaintenanceSummary,
        dailyData: deptDailyData
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
        reportFormatsCount,
      },
      operatorEfficiency,
      machineEfficiency,
      machineMaintenanceSummary,
      recentEntries,
      dailyData,
      departmentsSummary,
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
