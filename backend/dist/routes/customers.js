"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customersRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../db/prisma");
exports.customersRouter = (0, express_1.Router)();
exports.customersRouter.use(auth_1.authenticate);
exports.customersRouter.get('/', async (req, res) => {
    const tenantId = req.tenantId;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const customers = await prismaTenant.customer.findMany();
        res.json(customers);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
    }
});
// Admins only
exports.customersRouter.post('/', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const data = req.body;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const customer = await prismaTenant.customer.create({
            data: {
                company_id: tenantId,
                name: data.name,
                contact_person: data.contact_person,
                phone: data.phone,
                email: data.email,
                billing_address: data.billing_address,
                gst: data.gst
            }
        });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'CREATE',
                entity_type: 'Customer',
                entity_id: customer.id,
                company_id: tenantId,
                details: { name: customer.name }
            }
        });
        res.status(201).json(customer);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create customer', details: error.message });
    }
});
exports.customersRouter.delete('/:id', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        await prismaTenant.customer.delete({ where: { id } });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'DELETE',
                entity_type: 'Customer',
                entity_id: id,
                company_id: tenantId,
            }
        });
        res.json({ message: 'Customer deleted' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete customer', details: error.message });
    }
});
// Update customer details
exports.customersRouter.put('/:id', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    const data = req.body;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const original = await prismaTenant.customer.findUnique({ where: { id } });
        if (!original) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        const updated = await prismaTenant.customer.update({
            where: { id },
            data: {
                name: data.name,
                contact_person: data.contact_person,
                phone: data.phone,
                email: data.email,
                billing_address: data.billing_address,
                gst: data.gst
            }
        });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'EDIT',
                entity_type: 'Customer',
                entity_id: id,
                company_id: tenantId,
                details: {
                    before: { name: original.name, contact_person: original.contact_person, phone: original.phone, email: original.email, billing_address: original.billing_address, gst: original.gst },
                    after: { name: updated.name, contact_person: updated.contact_person, phone: updated.phone, email: updated.email, billing_address: updated.billing_address, gst: updated.gst }
                }
            }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update customer', details: error.message });
    }
});
