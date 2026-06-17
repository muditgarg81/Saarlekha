import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getTenantPrisma } from '../db/prisma';
import { encrypt, maskAadhaar } from '../utils/crypto';
import { verifySubscriptionLimit } from '../utils/subscription';

export const manpowerRouter = Router();

manpowerRouter.use(authenticate);

// List manpower (All roles, but RLS automatically filters by tenant, 
// and we should filter by assigned department for operations in the future if needed,
// but for now they can see all manpower in their tenant, or just their department)
manpowerRouter.get('/', async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });

  const prismaTenant = getTenantPrisma(tenantId);
  const search = (req.query.search as string | undefined)?.trim();

  try {
    const manpower = await prismaTenant.manpower.findMany({
      where: search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { role: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { aadhaar_masked: { contains: search, mode: 'insensitive' } },
          { department: { name: { contains: search, mode: 'insensitive' } } },
        ]
      } : undefined,
      take: 1000,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        photo_url: true,
        phone: true,
        aadhaar_masked: true,
        blood_group: true,
        emergency_contact: true,
        role: true,
        department_id: true,
        department: { select: { name: true } },
        created_at: true
      }
    });
    res.json(manpower);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch manpower', details: error.message });
  }
});

// Admins only for mutations
manpowerRouter.post('/', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const data = req.body;

  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });

  const prismaTenant = getTenantPrisma(tenantId);

  try {
    // Verify subscription limit
    await verifySubscriptionLimit(tenantId, 'manpower', 1);

    let aadhaarEncrypted = null;
    let aadhaarMasked = null;

    if (data.aadhaar) {
      aadhaarEncrypted = encrypt(data.aadhaar);
      aadhaarMasked = maskAadhaar(data.aadhaar);
    }

    const manpower = await prismaTenant.manpower.create({
      data: {
        company_id: tenantId,
        name: data.name,
        photo_url: data.photo_url,
        phone: data.phone,
        aadhaar_encrypted: aadhaarEncrypted,
        aadhaar_masked: aadhaarMasked,
        blood_group: data.blood_group,
        emergency_contact: data.emergency_contact,
        role: data.role,
        department_id: data.department_id,
      },
      select: {
        id: true, name: true, aadhaar_masked: true, department_id: true // Don't return encrypted
      }
    });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'CREATE',
        entity_type: 'Manpower',
        entity_id: manpower.id,
        company_id: tenantId,
        details: { name: manpower.name }
      }
    });

    res.status(201).json(manpower);
  } catch (error: any) {
    if (error.status === 403) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create manpower', details: error.message });
  }
});

// Edit manpower details
manpowerRouter.put('/:id', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  const data = req.body;

  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });

  const prismaTenant = getTenantPrisma(tenantId);

  try {
    const updateData: any = {
      name: data.name,
      photo_url: data.photo_url,
      phone: data.phone,
      blood_group: data.blood_group,
      emergency_contact: data.emergency_contact,
      role: data.role,
      department_id: data.department_id,
    };

    // If new Aadhaar is provided and doesn't contain masks, encrypt and mask it
    if (data.aadhaar && !data.aadhaar.includes('X')) {
      updateData.aadhaar_encrypted = encrypt(data.aadhaar);
      updateData.aadhaar_masked = maskAadhaar(data.aadhaar);
    }

    const manpower = await prismaTenant.manpower.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        photo_url: true,
        phone: true,
        aadhaar_masked: true,
        blood_group: true,
        emergency_contact: true,
        role: true,
        department_id: true,
        department: { select: { name: true } }
      }
    });

    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'EDIT',
        entity_type: 'Manpower',
        entity_id: manpower.id,
        company_id: tenantId,
        details: { name: manpower.name }
      }
    });

    res.json(manpower);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update manpower', details: error.message });
  }
});

manpowerRouter.delete('/:id', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  
  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
  
  const prismaTenant = getTenantPrisma(tenantId);

  try {
    await prismaTenant.manpower.delete({ where: { id } });
    
    await prismaTenant.auditLogEntry.create({
      data: {
        user_id: req.user!.id,
        action: 'DELETE',
        entity_type: 'Manpower',
        entity_id: id,
        company_id: tenantId,
      }
    });

    res.json({ message: 'Manpower deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete manpower', details: error.message });
  }
});

// Bulk delete manpower (Admin only)
manpowerRouter.post('/bulk-delete', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const { ids } = req.body;

  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid request: ids array is required' });
  }

  const prismaTenant = getTenantPrisma(tenantId);

  try {
    // Check if any manpower record has associated production records
    const inUse = await prismaTenant.productionRecord.findFirst({
      where: {
        operator_id: { in: ids },
        company_id: tenantId!
      }
    });

    if (inUse) {
      return res.status(400).json({
        error: 'One or more selected manpower records cannot be deleted because they are associated with existing production records.'
      });
    }

    const existing = await prismaTenant.manpower.findMany({
      where: { id: { in: ids }, company_id: tenantId! },
      select: { id: true, name: true }
    });

    if (existing.length === 0) {
      return res.status(404).json({ error: 'No matching manpower records found' });
    }

    await prismaTenant.$transaction(async (tx) => {
      await tx.manpower.deleteMany({
        where: { id: { in: ids }, company_id: tenantId! }
      });

      await tx.auditLogEntry.create({
        data: {
          user_id: req.user!.id,
          action: 'DELETE',
          entity_type: 'Manpower',
          entity_id: 'BULK_DELETE',
          company_id: tenantId,
          details: { deleted_ids: ids, operator_names: existing.map(p => p.name) }
        }
      });
    });

    res.json({ message: 'Manpower records bulk deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to bulk delete manpower', details: error.message });
  }
});
