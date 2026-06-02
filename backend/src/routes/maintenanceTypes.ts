import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getTenantPrisma } from '../db/prisma';

export const maintenanceTypesRouter = Router();

maintenanceTypesRouter.use(authenticate);

// Get all options
maintenanceTypesRouter.get('/', async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });

  const prismaTenant = getTenantPrisma(tenantId);
  try {
    const options = await prismaTenant.maintenanceTypeOption.findMany({
      orderBy: { created_at: 'asc' }
    });
    res.json(options);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch options', details: error.message });
  }
});

// Create new option
maintenanceTypesRouter.post('/', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const { name } = req.body;

  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Option name is required' });

  const prismaTenant = getTenantPrisma(tenantId);
  try {
    const option = await prismaTenant.maintenanceTypeOption.create({
      data: {
        name: name.trim(),
        company_id: tenantId
      }
    });

    // Also write an audit log
    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'CREATE',
        entity_type: 'MaintenanceTypeOption',
        entity_id: option.id,
        company_id: tenantId,
        details: { name: name.trim() }
      }
    });

    res.status(201).json(option);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create option', details: error.message });
  }
});

// Edit option
maintenanceTypesRouter.put('/:id', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  const { name } = req.body;

  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Option name is required' });

  const prismaTenant = getTenantPrisma(tenantId);
  try {
    const existing = await prismaTenant.maintenanceTypeOption.findFirst({
      where: { id, company_id: tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Option not found' });
    }

    const option = await prismaTenant.maintenanceTypeOption.update({
      where: { id },
      data: { name: name.trim() }
    });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'EDIT',
        entity_type: 'MaintenanceTypeOption',
        entity_id: id,
        company_id: tenantId,
        details: { before: existing.name, after: name.trim() }
      }
    });

    res.json(option);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update option', details: error.message });
  }
});

// Delete option
maintenanceTypesRouter.delete('/:id', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });

  const prismaTenant = getTenantPrisma(tenantId);
  try {
    const existing = await prismaTenant.maintenanceTypeOption.findFirst({
      where: { id, company_id: tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Option not found' });
    }

    await prismaTenant.maintenanceTypeOption.delete({
      where: { id }
    });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'DELETE',
        entity_type: 'MaintenanceTypeOption',
        entity_id: id,
        company_id: tenantId,
        details: { name: existing.name }
      }
    });

    res.json({ message: 'Option deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete option', details: error.message });
  }
});
