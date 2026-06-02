"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maintenanceTypesRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../db/prisma");
exports.maintenanceTypesRouter = (0, express_1.Router)();
exports.maintenanceTypesRouter.use(auth_1.authenticate);
// Get all options
exports.maintenanceTypesRouter.get('/', async (req, res) => {
    const tenantId = req.tenantId;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const options = await prismaTenant.maintenanceTypeOption.findMany({
            orderBy: { created_at: 'asc' }
        });
        res.json(options);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch options', details: error.message });
    }
});
// Create new option
exports.maintenanceTypesRouter.post('/', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const { name } = req.body;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    if (!name || !name.trim())
        return res.status(400).json({ error: 'Option name is required' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
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
                user_id: req.user.id,
                action: 'CREATE',
                entity_type: 'MaintenanceTypeOption',
                entity_id: option.id,
                company_id: tenantId,
                details: { name: name.trim() }
            }
        });
        res.status(201).json(option);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create option', details: error.message });
    }
});
// Edit option
exports.maintenanceTypesRouter.put('/:id', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    const { name } = req.body;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    if (!name || !name.trim())
        return res.status(400).json({ error: 'Option name is required' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
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
                user_id: req.user.id,
                action: 'EDIT',
                entity_type: 'MaintenanceTypeOption',
                entity_id: id,
                company_id: tenantId,
                details: { before: existing.name, after: name.trim() }
            }
        });
        res.json(option);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update option', details: error.message });
    }
});
// Delete option
exports.maintenanceTypesRouter.delete('/:id', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
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
                user_id: req.user.id,
                action: 'DELETE',
                entity_type: 'MaintenanceTypeOption',
                entity_id: id,
                company_id: tenantId,
                details: { name: existing.name }
            }
        });
        res.json({ message: 'Option deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete option', details: error.message });
    }
});
