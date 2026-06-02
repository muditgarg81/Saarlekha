import { Router } from 'express';
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

    // For OPERATIONS users, restrict to their assigned departments
    let deptFilter: string[] | undefined;
    if (user.role === 'OPERATIONS') {
      const userDepts = await (prismaTenant as any).userDepartment.findMany({
        where: { user_id: user.id },
        select: { department_id: true }
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

    // Active Manpower count
    const manpowerCount = await (prismaTenant as any).manpower.count();

    // Open Job Orders
    const openJobOrders = await (prismaTenant as any).jobOrder.count({
      where: { status: 'OPEN' }
    });

    // Production records for the period
    const productionWhere: any = {};
    if (dateFilter) productionWhere.date = dateFilter;
    if (deptFilter) {
      // production records are tied to operators (manpower) in departments
      const manpowerInDepts = await (prismaTenant as any).manpower.findMany({
        where: { department_id: { in: deptFilter } },
        select: { id: true }
      });
      productionWhere.operator_id = { in: manpowerInDepts.map((m: any) => m.id) };
    }

    const productionRecords = await (prismaTenant as any).productionRecord.findMany({
      where: productionWhere,
      include: {
        operator: { select: { id: true, name: true } },
        machine: { select: { id: true, name: true } }
      }
    });

    // Recent report entries
    const reportEntryWhere: any = {};
    if (dateFilter) reportEntryWhere.entry_date = dateFilter;
    if (deptFilter) reportEntryWhere.department_id = { in: deptFilter };

    // Fetch report entries for the period to extract unsynced machine production logs
    const reportEntries = await (prismaTenant as any).reportEntry.findMany({
      where: reportEntryWhere,
      include: {
        format_version: true
      }
    });

    const machineProdEntries = reportEntries.filter((e: any) => {
      const schema = e.format_version?.fields_schema || [];
      return hasMachineAndOperator(schema);
    });

    const syncedEntryIds = new Set(productionRecords.map((r: any) => r.report_entry_id).filter(Boolean));
    const unsyncedParsedEntries = machineProdEntries
      .filter((e: any) => !syncedEntryIds.has(e.id))
      .map((e: any) => parsePayload(e.payload))
      .filter(Boolean) as { operatorName: string; machineName: string; production: number; target: number }[];

    // Calculate total production and overall efficiency including unsynced entries
    const extraProduction = unsyncedParsedEntries.reduce((sum: number, entry) => sum + entry.production, 0);
    const extraTarget = unsyncedParsedEntries.reduce((sum: number, entry) => sum + entry.target, 0);

    const totalProduction = productionRecords.reduce((sum: number, r: any) => sum + r.production_amount, 0) + extraProduction;
    const totalTarget = productionRecords.reduce((sum: number, r: any) => sum + r.target_amount, 0) + extraTarget;
    const overallEfficiency = calculateEfficiency(totalProduction, totalTarget);

    // Operator-wise efficiency (grouped by name, case-insensitive)
    const operatorMap: Record<string, { name: string; production: number; target: number }> = {};
    for (const r of productionRecords) {
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

    // Machine-wise efficiency (grouped by name, case-insensitive)
    const machineMap: Record<string, { name: string; production: number; target: number }> = {};
    for (const r of productionRecords) {
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

    // Machine Maintenance Summary
    const machines = await (prismaTenant as any).machine.findMany({
      where: deptFilter ? {
        OR: [
          { department_id: { in: deptFilter } },
          { department_id: null }
        ]
      } : {},
      orderBy: { name: 'asc' }
    });

    const maintenanceEntries = await (prismaTenant as any).reportEntry.findMany({
      where: {
        company_id: tenantId,
        format_version: {
          format: {
            type: 'MAINTENANCE'
          }
        },
        ...(deptFilter ? { department_id: { in: deptFilter } } : {})
      },
      orderBy: [
        { entry_date: 'desc' },
        { created_at: 'desc' }
      ],
      include: {
        department: { select: { name: true } }
      }
    });

    const latestMaintenanceByMachine: Record<string, any> = {};
    for (const entry of maintenanceEntries) {
      const payload = (entry.payload as any) || {};
      const machineId = payload._machine_id;
      if (machineId && !latestMaintenanceByMachine[machineId]) {
        latestMaintenanceByMachine[machineId] = {
          lastMaintenanceDate: entry.entry_date,
          maintenanceType: payload._maintenance_type || 'N/A',
          status: payload._status || 'completed',
          departmentName: entry.department?.name || 'N/A'
        };
      }
    }

    const machineMaintenanceSummary = machines.map((machine: any) => {
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

    // Recent report entries
    const recentEntries = await (prismaTenant as any).reportEntry.findMany({
      where: reportEntryWhere,
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        format_version: { include: { format: { select: { name: true, type: true } } } },
        department: { select: { name: true } },
        submitter: { select: { email: true } }
      }
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

// Production entry endpoint for logging daily data
dashboardRouter.post('/production', async (req, res) => {
  const tenantId = req.tenantId!;
  const data = req.body;
  const prismaTenant = getTenantPrisma(tenantId);

  try {
    let departmentId = data.department_id;
    if (!departmentId) {
      const machine = await prismaTenant.machine.findUnique({
        where: { id: data.machine_id },
        select: { department_id: true }
      });
      departmentId = machine?.department_id || undefined;
    }
    if (!departmentId) {
      const operator = await prismaTenant.manpower.findUnique({
        where: { id: data.operator_id },
        select: { department_id: true }
      });
      departmentId = operator?.department_id || undefined;
    }
    if (!departmentId) {
      return res.status(400).json({ error: 'Department ID is required and could not be resolved from machine or operator.' });
    }

    const record = await (prismaTenant as any).productionRecord.create({
      data: {
        company_id: tenantId,
        date: new Date(data.date),
        production_amount: parseFloat(data.production_amount),
        target_amount: parseFloat(data.target_amount),
        operator_id: data.operator_id,
        machine_id: data.machine_id,
        department_id: departmentId
      }
    });
    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to log production', details: error.message });
  }
});
