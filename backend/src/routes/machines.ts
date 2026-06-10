import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getTenantPrisma } from '../db/prisma';
import { verifySubscriptionLimit } from '../utils/subscription';

export const machinesRouter = Router();
machinesRouter.use(authenticate);

machinesRouter.get('/', async (req, res) => {
  const tenantId = req.tenantId;
  const prismaTenant = getTenantPrisma(tenantId!);

  try {
    const machines = await prismaTenant.machine.findMany({
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    res.json(machines);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch machines', details: error.message });
  }
});

machinesRouter.post('/', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const data = req.body;
  const prismaTenant = getTenantPrisma(tenantId!);

  try {
    // Verify subscription limit
    if (Array.isArray(data)) {
      await verifySubscriptionLimit(tenantId!, 'machines', data.length);
    } else {
      await verifySubscriptionLimit(tenantId!, 'machines', 1);
    }

    if (Array.isArray(data)) {
      const createdMachines = await prismaTenant.$transaction(async (tx) => {
        const promises = data.map(async (item) => {
          const m = await tx.machine.create({
            data: {
              company_id: tenantId!,
              name: item.name,
              type: item.type,
              location: item.location,
              department_id: item.department_id || null
            },
            include: {
              department: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          });
          
          await tx.auditLogEntry.create({
            data: {
              user_id: req.user!.id,
              action: 'CREATE',
              entity_type: 'Machine',
              entity_id: m.id,
              company_id: tenantId,
              details: { name: m.name, department_id: m.department_id }
            }
          });
          return m;
        });

        return Promise.all(promises);
      }, {
        timeout: 30000 // 30 seconds to support larger batches on remote DBs
      });
      return res.status(201).json(createdMachines);
    }

    const machine = await prismaTenant.machine.create({
      data: {
        company_id: tenantId!,
        name: data.name,
        type: data.type,
        location: data.location,
        department_id: data.department_id || null
      },
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'CREATE',
        entity_type: 'Machine',
        entity_id: machine.id,
        company_id: tenantId,
        details: { name: machine.name, department_id: machine.department_id }
      }
    });

    res.status(201).json(machine);
  } catch (error: any) {
    if (error.status === 403) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Error in POST /api/machines:', error);
    res.status(500).json({ error: 'Failed to create machine', details: error.message });
  }
});

// Edit machine details
machinesRouter.put('/:id', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  const data = req.body;
  const prismaTenant = getTenantPrisma(tenantId!);

  try {
    const machine = await prismaTenant.machine.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        location: data.location,
        department_id: data.department_id || null
      },
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'EDIT',
        entity_type: 'Machine',
        entity_id: machine.id,
        company_id: tenantId,
        details: { name: machine.name, department_id: machine.department_id }
      }
    });

    res.json(machine);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update machine', details: error.message });
  }
});

// Delete machine
machinesRouter.delete('/:id', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  const prismaTenant = getTenantPrisma(tenantId!);

  try {
    // Check if in use in production records
    const hasRecords = await prismaTenant.productionRecord.findFirst({
      where: { machine_id: id }
    });

    if (hasRecords) {
      return res.status(400).json({
        error: 'Machine cannot be deleted because it has production records associated with it.'
      });
    }

    await prismaTenant.machine.delete({
      where: { id }
    });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'DELETE',
        entity_type: 'Machine',
        entity_id: id,
        company_id: tenantId,
      }
    });

    res.json({ message: 'Machine deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete machine', details: error.message });
  }
});

// Bulk delete machines (Admin only)
machinesRouter.post('/bulk-delete', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const { ids } = req.body;
  const prismaTenant = getTenantPrisma(tenantId!);

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid request: ids array is required' });
  }

  try {
    // Check if any machine has associated production records
    const inUse = await prismaTenant.productionRecord.findFirst({
      where: {
        machine_id: { in: ids },
        company_id: tenantId!
      }
    });

    if (inUse) {
      return res.status(400).json({
        error: 'One or more selected machines cannot be deleted because they are associated with existing production records.'
      });
    }

    const existing = await prismaTenant.machine.findMany({
      where: { id: { in: ids }, company_id: tenantId! }
    });

    if (existing.length === 0) {
      return res.status(404).json({ error: 'No matching machines found' });
    }

    await prismaTenant.$transaction(async (tx) => {
      await tx.machine.deleteMany({
        where: { id: { in: ids }, company_id: tenantId! }
      });

      await tx.auditLogEntry.create({
        data: {
          user_id: req.user!.id,
          action: 'DELETE',
          entity_type: 'Machine',
          entity_id: 'BULK_DELETE',
          company_id: tenantId,
          details: { deleted_ids: ids, machine_names: existing.map(m => m.name) }
        }
      });
    });

    res.json({ message: 'Machines bulk deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to bulk delete machines', details: error.message });
  }
});
