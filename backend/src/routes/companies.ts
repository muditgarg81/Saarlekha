import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getTenantPrisma, prisma } from '../db/prisma';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendEmail } from '../utils/email';
import { sanitizeDatabaseError } from '../utils/db-errors';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

export const companiesRouter = Router();

companiesRouter.use(authenticate);

// Super Admin can see all companies, Company admin sees only theirs
companiesRouter.get('/', async (req, res) => {
  try {
    if (req.user?.role === 'SUPER_ADMIN') {
      // Super admin can see all companies (bypassing tenant extension for this specific query)
      const companies = await prisma.company.findMany({
        orderBy: { name: 'asc' }
      });
      return res.json(companies);
    } else {
      const tenantId = req.tenantId;
      if (!tenantId) return res.status(403).json({ error: 'Tenant ID missing' });
      
      const prismaTenant = getTenantPrisma(tenantId);
      const company = await prismaTenant.company.findUnique({ where: { id: tenantId } });
      return res.json([company]);
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch companies', details: sanitizeDatabaseError(error) });
  }
});

// Update company info (Company admin or Super admin)
companiesRouter.put('/:id', requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
  const id = req.params.id as string;
  const data = req.body;
  const tenantId = req.tenantId;

  if (req.user?.role !== 'SUPER_ADMIN' && tenantId !== id) {
    return res.status(403).json({ error: 'Forbidden to update another company' });
  }

  // Use base prisma if super admin, else tenant prisma
  const db = req.user?.role === 'SUPER_ADMIN' ? prisma : getTenantPrisma(tenantId!);

  try {
    const updated = await db.company.update({
      where: { id: id as string },
      data: {
        name: data.name,
        address: data.address,
        logo_url: data.logo_url,
        gst: data.gst,
        contact_name: data.contact_name,
        phone: data.phone,
        email: data.email
      }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update company', details: sanitizeDatabaseError(error) });
  }
});

// Create more companies (Super Admin only)
companiesRouter.post('/', requireRole(['SUPER_ADMIN']), async (req, res) => {
  const { name, address, logo_url, gst, contact_name, email, phone, adminEmail } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  if (adminEmail) {
    const existingUser = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.login_email', ${adminEmail}, true)`;
      return tx.user.findUnique({ where: { email: adminEmail } });
    });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this admin email already exists. Please use a unique email address.' });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create company
      const company = await tx.company.create({
        data: { name, address, logo_url, gst, contact_name, email, phone }
      });

      // 2. Set current_tenant_id so we can insert User and Token under RLS WITH CHECK policy
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${company.id}, true)`;

      // 3. If admin email is provided, create admin and generate invite link
      let adminUser = null;
      let inviteLink = null;

      if (adminEmail) {
        adminUser = await tx.user.create({
          data: {
            email: adminEmail,
            role: 'COMPANY_ADMIN',
            company_id: company.id,
            is_email_verified: false
          }
        });

        // Generate invitation token
        const tokenString = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await tx.token.create({
          data: {
            token: tokenString,
            type: 'INVITE',
            user_id: adminUser.id,
            expires_at: expiresAt
          }
        });

        inviteLink = `${APP_URL}/setup-password?token=${tokenString}`;

        // Send onboarding email
        sendEmail({
          to: adminEmail,
          subject: 'Welcome to Saarlekha - Onboarding Invitation',
          html: `
            <h2>Welcome to Saarlekha!</h2>
            <p>Your company <strong>${company.name}</strong> has been successfully onboarded.</p>
            <p>Please click the link below to configure your administrator password and activate your account:</p>
            <p><a href="${inviteLink}" style="padding: 10px 20px; background-color: #0059bb; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Configure Account</a></p>
            <p>Or copy and paste this URL into your browser:</p>
            <p>${inviteLink}</p>
            <p>This link is valid for 24 hours.</p>
          `,
          text: `Welcome to Saarlekha!\n\nYour company ${company.name} has been onboarded.\n\nPlease configure your administrator password by clicking here: ${inviteLink}\n\nThis link is valid for 24 hours.`
        }).catch(err => console.error('Error sending onboarding email:', err));
      }

      await tx.auditLogEntry.create({
        data: {
          user_id: req.user!.id,
          action: 'CREATE',
          entity_type: 'Company',
          entity_id: company.id,
          company_id: company.id,
          details: { name: company.name, adminEmail }
        }
      });

      return { company, adminUser, inviteLink };
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create company', details: sanitizeDatabaseError(error) });
  }
});

// Delete company (Super Admin only)
companiesRouter.delete('/:id', requireRole(['SUPER_ADMIN']), async (req, res) => {
  const id = req.params.id as string;

  try {
    await prisma.$transaction(async (tx) => {
      // Delete dependent records first to satisfy constraint checks
      await tx.auditLogEntry.deleteMany({ where: { company_id: id } });
      await tx.productionRecord.deleteMany({ where: { company_id: id } });
      await tx.reportEntry.deleteMany({ where: { company_id: id } });
      await tx.jobOrder.deleteMany({ where: { company_id: id } });
      await tx.machine.deleteMany({ where: { company_id: id } });
      
      const formats = await tx.reportFormat.findMany({ where: { company_id: id } });
      const formatIds = formats.map(f => f.id);
      await tx.reportFormatVersion.deleteMany({ where: { format_id: { in: formatIds } } });
      await tx.reportFormat.deleteMany({ where: { company_id: id } });
      
      await tx.item.deleteMany({ where: { company_id: id } });
      await tx.customer.deleteMany({ where: { company_id: id } });
      await tx.manpower.deleteMany({ where: { company_id: id } });
      
      const users = await tx.user.findMany({ where: { company_id: id } });
      const userIds = users.map(u => u.id);
      await tx.userDepartment.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.user.deleteMany({ where: { company_id: id } });
      
      await tx.department.deleteMany({ where: { company_id: id } });
      
      // Finally, delete the company itself
      await tx.company.delete({ where: { id } });
    });

    res.json({ message: 'Company and all associated data deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete company', details: sanitizeDatabaseError(error) });
  }
});
