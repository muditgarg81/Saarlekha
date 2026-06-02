"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.itemsRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../db/prisma");
exports.itemsRouter = (0, express_1.Router)();
exports.itemsRouter.use(auth_1.authenticate);
// List items (filter by status optionally)
exports.itemsRouter.get('/', async (req, res) => {
    const tenantId = req.tenantId;
    const { status } = req.query; // e.g., PENDING, ACTIVE
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const whereClause = {};
        if (status)
            whereClause.status = status;
        const items = await prismaTenant.item.findMany({
            where: whereClause,
            include: {
                submitter: { select: { email: true } },
                approver: { select: { email: true } }
            }
        });
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch items', details: error.message });
    }
});
// Operations can create, Admin can create
exports.itemsRouter.post('/', async (req, res) => {
    const tenantId = req.tenantId;
    const data = req.body;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const isOps = req.user.role === 'OPERATIONS';
        const status = isOps ? 'PENDING' : 'ACTIVE';
        const item = await prismaTenant.item.create({
            data: {
                company_id: tenantId,
                name: data.name,
                custom_data: data.custom_data,
                status,
                submitted_by: req.user.id,
                approved_by: isOps ? null : req.user.id
            }
        });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'CREATE',
                entity_type: 'Item',
                entity_id: item.id,
                company_id: tenantId,
                details: { name: item.name, status: 'PENDING' }
            }
        });
        res.status(201).json(item);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create item', details: error.message });
    }
});
// Admin approval workflow
exports.itemsRouter.patch('/:id/approve', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const item = await prismaTenant.item.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                approved_by: req.user.id
            }
        });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'APPROVE',
                entity_type: 'Item',
                entity_id: id,
                company_id: tenantId,
            }
        });
        res.json(item);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to approve item', details: error.message });
    }
});
// Admin rejection workflow
exports.itemsRouter.patch('/:id/reject', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    const { reason } = req.body;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const item = await prismaTenant.item.update({
            where: { id },
            data: {
                status: 'REJECTED',
                reject_reason: reason || null,
                approved_by: req.user.id // We track who rejected it in the same column or rely on audit log
            }
        });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'REJECT',
                entity_type: 'Item',
                entity_id: id,
                company_id: tenantId,
                details: { reason }
            }
        });
        res.json(item);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to reject item', details: error.message });
    }
});
// Edit an item (Admin only)
exports.itemsRouter.put('/:id', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    const data = req.body;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const prevItem = await prismaTenant.item.findUnique({ where: { id } });
        if (!prevItem)
            return res.status(404).json({ error: 'Item not found' });
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
                user_id: req.user.id,
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update item', details: error.message });
    }
});
// Delete an item (Admin only)
exports.itemsRouter.delete('/:id', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const prevItem = await prismaTenant.item.findUnique({ where: { id } });
        if (!prevItem)
            return res.status(404).json({ error: 'Item not found' });
        await prismaTenant.item.delete({ where: { id } });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'DELETE',
                entity_type: 'Item',
                entity_id: id,
                company_id: tenantId,
                details: { name: prevItem.name }
            }
        });
        res.json({ message: 'Item deleted' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete item', details: error.message });
    }
});
