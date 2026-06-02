import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getTenantPrisma } from '../db/prisma';

export const auditRouter = Router();
auditRouter.use(authenticate, requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']));

auditRouter.get('/', async (req, res) => {
  const tenantId = req.tenantId!;
  const prismaTenant = getTenantPrisma(tenantId, req.user?.role);
  const { page = '1', limit = '50', entity, action } = req.query;

  try {
    const where: any = {};
    if (entity) where.entity_type = entity as string;
    if (action) where.action = action as string;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [logs, total] = await Promise.all([
      (prismaTenant as any).auditLogEntry.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: parseInt(limit as string),
        include: {
          user: { select: { email: true, role: true } }
        }
      }),
      (prismaTenant as any).auditLogEntry.count({ where })
    ]);

    res.json({ logs, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch audit log', details: error.message });
  }
});
