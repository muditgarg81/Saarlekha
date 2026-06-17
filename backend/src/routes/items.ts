import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getTenantPrisma } from '../db/prisma';

export const itemsRouter = Router();

itemsRouter.use(authenticate);

// List items (filter by status optionally)
itemsRouter.get('/', async (req, res) => {
  const tenantId = req.tenantId;
  const { status, search } = req.query;
  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });

  const prismaTenant = getTenantPrisma(tenantId);
  try {
    const searchTerm = (search as string | undefined)?.trim();
    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (searchTerm) {
      whereClause.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { status: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const items = await prismaTenant.item.findMany({
      where: whereClause,
      take: 1000,
      orderBy: { created_at: 'desc' },
      include: {
        submitter: { select: { email: true } },
        approver: { select: { email: true } }
      }
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch items', details: error.message });
  }
});

// Operations can create, Admin can create
itemsRouter.post('/', async (req, res) => {
  const tenantId = req.tenantId;
  const data = req.body;
  
  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
  const prismaTenant = getTenantPrisma(tenantId);

  try {
    const isOps = req.user!.role === 'OPERATIONS';
    const status = isOps ? 'PENDING' : 'ACTIVE';

    const item = await prismaTenant.item.create({
      data: {
        company_id: tenantId,
        name: data.name,
        custom_data: data.custom_data,
        status,
        submitted_by: req.user!.id,
        approved_by: isOps ? null : req.user!.id
      }
    });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'CREATE',
        entity_type: 'Item',
        entity_id: item.id,
        company_id: tenantId,
        details: { name: item.name, status: 'PENDING' }
      }
    });

    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create item', details: error.message });
  }
});

// Admin approval workflow
itemsRouter.patch('/:id/approve', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  
  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
  const prismaTenant = getTenantPrisma(tenantId);

  try {
    const item = await prismaTenant.item.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        approved_by: req.user!.id
      }
    });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'APPROVE',
        entity_type: 'Item',
        entity_id: id,
        company_id: tenantId,
      }
    });

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to approve item', details: error.message });
  }
});

// Admin rejection workflow
itemsRouter.patch('/:id/reject', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  const { reason } = req.body;
  
  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
  const prismaTenant = getTenantPrisma(tenantId);

  try {
    const item = await prismaTenant.item.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reject_reason: reason || null,
        approved_by: req.user!.id // We track who rejected it in the same column or rely on audit log
      }
    });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'REJECT',
        entity_type: 'Item',
        entity_id: id,
        company_id: tenantId,
        details: { reason }
      }
    });

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reject item', details: error.message });
  }
});

// Edit an item (Admin only)
itemsRouter.put('/:id', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  const data = req.body;

  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
  const prismaTenant = getTenantPrisma(tenantId);

  try {
    const prevItem = await prismaTenant.item.findUnique({ where: { id } });
    if (!prevItem) return res.status(404).json({ error: 'Item not found' });

    const item = await prismaTenant.item.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        custom_data: data.custom_data !== undefined ? data.custom_data : undefined,
        status: data.status !== undefined ? data.status : undefined,
        reject_reason: data.reject_reason !== undefined ? data.reject_reason : undefined,
      }
    });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'EDIT',
        entity_type: 'Item',
        entity_id: id,
        company_id: tenantId,
        details: {
          before: { name: prevItem.name, status: prevItem.status },
          after: { name: item.name, status: item.status }
        }
      }
    });

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update item', details: error.message });
  }
});

// Delete an item (Admin only)
itemsRouter.delete('/:id', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
  const prismaTenant = getTenantPrisma(tenantId);

  try {
    const prevItem = await prismaTenant.item.findUnique({ where: { id } });
    if (!prevItem) return res.status(404).json({ error: 'Item not found' });

    await prismaTenant.item.delete({ where: { id } });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'DELETE',
        entity_type: 'Item',
        entity_id: id,
        company_id: tenantId,
        details: { name: prevItem.name }
      }
    });

    res.json({ message: 'Item deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete item', details: error.message });
  }
});

