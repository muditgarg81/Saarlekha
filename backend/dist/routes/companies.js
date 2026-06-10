"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.companiesRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../db/prisma");
const crypto_1 = __importDefault(require("crypto"));
const email_1 = require("../utils/email");
const db_errors_1 = require("../utils/db-errors");
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
exports.companiesRouter = (0, express_1.Router)();
exports.companiesRouter.use(auth_1.authenticate);
// Super Admin can see all companies, Company admin sees only theirs
exports.companiesRouter.get('/', async (req, res) => {
    try {
        if (req.user?.role === 'SUPER_ADMIN') {
            // Super admin can see all companies (bypassing tenant extension for this specific query)
            const companies = await prisma_1.prisma.company.findMany({
                orderBy: { name: 'asc' }
            });
            return res.json(companies);
        }
        else {
            const tenantId = req.tenantId;
            if (!tenantId)
                return res.status(403).json({ error: 'Tenant ID missing' });
            const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
            const company = await prismaTenant.company.findUnique({ where: { id: tenantId } });
            return res.json([company]);
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch companies', details: (0, db_errors_1.sanitizeDatabaseError)(error) });
    }
});
// Update company info (Company admin or Super admin)
exports.companiesRouter.put('/:id', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const id = req.params.id;
    const data = req.body;
    const tenantId = req.tenantId;
    if (req.user?.role !== 'SUPER_ADMIN' && tenantId !== id) {
        return res.status(403).json({ error: 'Forbidden to update another company' });
    }
    // Use base prisma if super admin, else tenant prisma
    const db = req.user?.role === 'SUPER_ADMIN' ? prisma_1.prisma : (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const updated = await db.company.update({
            where: { id: id },
            data: {
                name: data.name,
                address: data.address,
                logo_url: data.logo_url,
                gst: data.gst,
                contact_name: data.contact_name,
                phone: data.phone,
                email: data.email,
                retention_days: data.retention_days !== undefined ? (data.retention_days === null || data.retention_days === '' ? null : parseInt(data.retention_days, 10)) : undefined,
                subscription_tier: req.user?.role === 'SUPER_ADMIN' ? data.subscription_tier : undefined
            }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update company', details: (0, db_errors_1.sanitizeDatabaseError)(error) });
    }
});
// Create more companies (Super Admin only)
exports.companiesRouter.post('/', (0, auth_1.requireRole)(['SUPER_ADMIN']), async (req, res) => {
    const { name, address, logo_url, gst, contact_name, email, phone, adminEmail, subscription_tier } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Company name is required' });
    }
    if (adminEmail) {
        const existingUser = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT set_config('app.login_email', ${adminEmail}, true)`;
            return tx.user.findUnique({ where: { email: adminEmail } });
        });
        if (existingUser) {
            return res.status(400).json({ error: 'An account with this admin email already exists. Please use a unique email address.' });
        }
    }
    try {
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Create company
            const company = await tx.company.create({
                data: { name, address, logo_url, gst, contact_name, email, phone, subscription_tier: subscription_tier || 'STARTER' }
            });
            // 2. Set current_tenant_id so we can insert User and Token under RLS WITH CHECK policy
            await tx.$executeRaw `SELECT set_config('app.current_tenant_id', ${company.id}, true)`;
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
                const tokenString = crypto_1.default.randomBytes(32).toString('hex');
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
                (0, email_1.sendEmail)({
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
                    user_id: req.user.id,
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create company', details: (0, db_errors_1.sanitizeDatabaseError)(error) });
    }
});
// Delete company (Super Admin only)
exports.companiesRouter.delete('/:id', (0, auth_1.requireRole)(['SUPER_ADMIN']), async (req, res) => {
    const id = req.params.id;
    try {
        await prisma_1.prisma.$transaction(async (tx) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete company', details: (0, db_errors_1.sanitizeDatabaseError)(error) });
    }
});
// Helper to get cutoff date based on company's retention days
async function getRetentionCutoff(companyId, db) {
    const company = await db.company.findUnique({
        where: { id: companyId },
        select: { retention_days: true }
    });
    if (!company || !company.retention_days || company.retention_days <= 0) {
        return null; // Indefinite retention
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - company.retention_days);
    return cutoff;
}
// 1. Get counts of data older than the retention period
exports.companiesRouter.get('/:id/retention-status', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const id = req.params.id;
    const tenantId = req.tenantId;
    if (req.user?.role !== 'SUPER_ADMIN' && tenantId !== id) {
        return res.status(403).json({ error: 'Forbidden to view another company status' });
    }
    const db = req.user?.role === 'SUPER_ADMIN' ? (0, prisma_1.getTenantPrisma)(id) : (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const cutoff = await getRetentionCutoff(id, db);
        if (!cutoff) {
            return res.json({
                retentionDays: (await db.company.findUnique({ where: { id }, select: { retention_days: true } }))?.retention_days || null,
                olderEntriesCount: 0,
                olderProductionCount: 0
            });
        }
        // Run queries
        const olderEntriesCount = await db.reportEntry.count({
            where: {
                company_id: id,
                entry_date: { lt: cutoff }
            }
        });
        const olderProductionCount = await db.productionRecord.count({
            where: {
                company_id: id,
                date: { lt: cutoff }
            }
        });
        res.json({
            retentionDays: (await db.company.findUnique({ where: { id }, select: { retention_days: true } }))?.retention_days || null,
            olderEntriesCount,
            olderProductionCount
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get retention status', details: (0, db_errors_1.sanitizeDatabaseError)(error) });
    }
});
// 2. Download historical data older than the retention period
exports.companiesRouter.get('/:id/archive-data', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const id = req.params.id;
    const tenantId = req.tenantId;
    if (req.user?.role !== 'SUPER_ADMIN' && tenantId !== id) {
        return res.status(403).json({ error: 'Forbidden to archive another company data' });
    }
    const db = req.user?.role === 'SUPER_ADMIN' ? (0, prisma_1.getTenantPrisma)(id) : (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const cutoff = await getRetentionCutoff(id, db);
        if (!cutoff) {
            return res.status(400).json({ error: 'No active data retention period is set for this company.' });
        }
        const company = await db.company.findUnique({ where: { id } });
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        // Query entries
        const reportEntries = await db.reportEntry.findMany({
            where: {
                company_id: id,
                entry_date: { lt: cutoff }
            },
            orderBy: { entry_date: 'asc' },
            include: {
                format_version: {
                    include: {
                        format: { select: { name: true, type: true } }
                    }
                },
                department: { select: { name: true } },
                submitter: { select: { email: true } }
            }
        });
        // Query production logs
        const productionRecords = await db.productionRecord.findMany({
            where: {
                company_id: id,
                date: { lt: cutoff }
            },
            orderBy: { date: 'asc' },
            include: {
                operator: { select: { name: true } },
                machine: { select: { name: true } },
                department: { select: { name: true } }
            }
        });
        const archive = {
            companyId: company.id,
            companyName: company.name,
            retentionDays: company.retention_days,
            exportedAt: new Date().toISOString(),
            cutoffDate: cutoff.toISOString(),
            reportEntriesCount: reportEntries.length,
            productionRecordsCount: productionRecords.length,
            reportEntries,
            productionRecords
        };
        const filename = `saarlekha_archive_${company.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(archive, null, 2));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to archive data', details: (0, db_errors_1.sanitizeDatabaseError)(error) });
    }
});
// 3. Purge data older than retention period
exports.companiesRouter.post('/:id/purge-data', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const id = req.params.id;
    const tenantId = req.tenantId;
    if (req.user?.role !== 'SUPER_ADMIN' && tenantId !== id) {
        return res.status(403).json({ error: 'Forbidden to purge another company data' });
    }
    const db = req.user?.role === 'SUPER_ADMIN' ? (0, prisma_1.getTenantPrisma)(id) : (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const cutoff = await getRetentionCutoff(id, db);
        if (!cutoff) {
            return res.status(400).json({ error: 'No active data retention period is set for this company.' });
        }
        const result = await db.$transaction(async (tx) => {
            // 1. Count first
            const reportEntriesCount = await tx.reportEntry.count({
                where: {
                    company_id: id,
                    entry_date: { lt: cutoff }
                }
            });
            const productionRecordsCount = await tx.productionRecord.count({
                where: {
                    company_id: id,
                    date: { lt: cutoff }
                }
            });
            // 2. Delete ProductionRecord first
            await tx.productionRecord.deleteMany({
                where: {
                    company_id: id,
                    date: { lt: cutoff }
                }
            });
            // 3. Delete ReportEntry second
            await tx.reportEntry.deleteMany({
                where: {
                    company_id: id,
                    entry_date: { lt: cutoff }
                }
            });
            // Log action to audit trails
            await tx.auditLogEntry.create({
                data: {
                    company_id: id,
                    user_id: req.user.id,
                    action: 'DELETE',
                    entity_type: 'ReportEntry',
                    entity_id: id,
                    details: {
                        message: 'Historical data purged according to retention policy.',
                        cutoffDate: cutoff.toISOString(),
                        purgedReportEntries: reportEntriesCount,
                        purgedProductionRecords: productionRecordsCount
                    }
                }
            });
            return {
                success: true,
                deletedReportEntries: reportEntriesCount,
                deletedProductionRecords: productionRecordsCount
            };
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to purge data', details: (0, db_errors_1.sanitizeDatabaseError)(error) });
    }
});
