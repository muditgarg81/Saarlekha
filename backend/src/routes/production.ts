import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getTenantPrisma } from '../db/prisma';

export const productionRouter = Router();
productionRouter.use(authenticate);

// List production records (with optional date filtering for efficiency calculation)
productionRouter.get('/', async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, operatorId, machineId } = req.query;
  const prismaTenant = getTenantPrisma(tenantId!);

  try {
    const where: any = {};
    if (operatorId) where.operator_id = operatorId;
    if (machineId) where.machine_id = machineId;
    if (startDate && endDate) {
      const end = new Date(endDate as string);
      end.setUTCHours(23, 59, 59, 999);
      where.date = {
        gte: new Date(startDate as string),
        lte: end
      };
    }

    const records = await prismaTenant.productionRecord.findMany({
      where,
      include: {
        operator: { select: { name: true } },
        machine: { select: { name: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch production records', details: error.message });
  }
});

productionRouter.post('/', async (req, res) => {
  const tenantId = req.tenantId;
  const data = req.body;
  const prismaTenant = getTenantPrisma(tenantId!);

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

    const record = await prismaTenant.productionRecord.create({
      data: {
        company_id: tenantId!,
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

// Delete single production record
productionRouter.delete('/:id', async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const prismaTenant = getTenantPrisma(tenantId!);

  try {
    const record = await prismaTenant.productionRecord.findFirst({
      where: { id, company_id: tenantId! }
    });

    if (!record) {
      return res.status(404).json({ error: 'Production record not found' });
    }

    await prismaTenant.$transaction(async (tx) => {
      await tx.productionRecord.delete({ where: { id } });

      if (record.report_entry_id) {
        await tx.reportEntry.deleteMany({
          where: { id: record.report_entry_id }
        });
      }
    });

    res.json({ message: 'Production record deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete production record', details: error.message });
  }
});

// Bulk delete production records
productionRouter.post('/bulk-delete', async (req, res) => {
  const tenantId = req.tenantId;
  const { ids } = req.body;
  const prismaTenant = getTenantPrisma(tenantId!);

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid request: ids array is required' });
  }

  try {
    await prismaTenant.$transaction(async (tx) => {
      const records = await tx.productionRecord.findMany({
        where: { id: { in: ids }, company_id: tenantId! }
      });

      const reportEntryIds = records
        .map(r => r.report_entry_id)
        .filter((id): id is string => !!id);

      await tx.productionRecord.deleteMany({
        where: { id: { in: ids }, company_id: tenantId! }
      });

      if (reportEntryIds.length > 0) {
        await tx.reportEntry.deleteMany({
          where: { id: { in: reportEntryIds }, company_id: tenantId! }
        });
      }
    });

    res.json({ message: 'Production records deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to bulk delete production records', details: error.message });
  }
});
