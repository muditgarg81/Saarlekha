import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getTenantPrisma } from '../db/prisma';

export const departmentsRouter = Router();

departmentsRouter.use(authenticate);

departmentsRouter.get('/', async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });

  const prismaTenant = getTenantPrisma(tenantId);
  
  try {
    let departments;
    if (req.user?.role === 'OPERATIONS') {
      // Return only departments assigned to this operations user
      const userDepts = await prismaTenant.userDepartment.findMany({
        where: { user_id: req.user.id },
        include: { department: true }
      });
      departments = userDepts.map(ud => ud.department);
    } else {
      // Admins and Super Admins see all departments in the company
      departments = await prismaTenant.department.findMany({
        orderBy: { name: 'asc' }
      });
    }
    res.json(departments);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch departments', details: error.message });
  }
});

departmentsRouter.post('/', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const { name } = req.body;

  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
  if (!name) return res.status(400).json({ error: 'Department name is required' });

  const prismaTenant = getTenantPrisma(tenantId);
  
  try {
    const department = await prismaTenant.department.create({
      data: {
        name,
        company_id: tenantId
      }
    });

    res.status(201).json(department);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create department', details: error.message });
  }
});

// Update department name
departmentsRouter.put('/:id', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  const { name } = req.body;

  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
  if (!name) return res.status(400).json({ error: 'Department name is required' });

  const prismaTenant = getTenantPrisma(tenantId);
  
  try {
    const department = await prismaTenant.department.update({
      where: { id },
      data: { name }
    });

    res.json(department);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update department', details: error.message });
  }
});

// Delete department
departmentsRouter.delete('/:id', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });

  const prismaTenant = getTenantPrisma(tenantId);
  
  try {
    // Check if in use
    const hasUsers = await prismaTenant.userDepartment.findFirst({ where: { department_id: id } });
    const hasManpower = await prismaTenant.manpower.findFirst({ where: { department_id: id } });
    const hasReports = await prismaTenant.reportEntry.findFirst({ where: { department_id: id } });

    if (hasUsers || hasManpower || hasReports) {
      return res.status(400).json({ 
        error: 'Department is currently in use by users, manpower, or report entries and cannot be deleted.' 
      });
    }

    await prismaTenant.department.delete({ where: { id } });
    res.json({ message: 'Department deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete department', details: error.message });
  }
});
