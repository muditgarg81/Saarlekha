"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobOrdersRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../db/prisma");
const sync_1 = require("../utils/sync");
exports.jobOrdersRouter = (0, express_1.Router)();
exports.jobOrdersRouter.use(auth_1.authenticate);
exports.jobOrdersRouter.get('/', async (req, res) => {
    const tenantId = req.tenantId;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    const user = req.user;
    try {
        // Run a fast, 3-query in-memory check to keep all job order production quantities synchronized
        await (0, sync_1.syncAllJobOrdersProduction)(prismaTenant, tenantId);
        const where = { company_id: tenantId };
        if (user.role === 'OPERATIONS') {
            const userDepts = await prismaTenant.userDepartment.findMany({
                where: { user_id: user.id },
                select: { department_id: true }
            });
            const allowedDeptIds = userDepts.map((d) => d.department_id);
            where.department_id = { in: allowedDeptIds };
        }
        const orders = await prismaTenant.jobOrder.findMany({
            where,
            include: {
                customer: { select: { name: true } },
                department: { select: { name: true } },
                item: { select: { name: true } }
            },
            orderBy: {
                order_number: 'asc'
            }
        });
        res.json(orders);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch job orders', details: error.message });
    }
});
exports.jobOrdersRouter.post('/', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const data = req.body;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        // Auto-generate sequential job order number (JO-XXXXX) for this tenant
        const existingOrders = await prismaTenant.jobOrder.findMany({
            where: {
                company_id: tenantId,
                order_number: { startsWith: 'JO-' }
            },
            select: { order_number: true }
        });
        let maxNum = 0;
        existingOrders.forEach(o => {
            const match = o.order_number.match(/JO-(\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) {
                    maxNum = num;
                }
            }
        });
        const nextNum = maxNum + 1;
        const generatedOrderNumber = `JO-${String(nextNum).padStart(5, '0')}`;
        const order = await prismaTenant.jobOrder.create({
            data: {
                company_id: tenantId,
                order_number: generatedOrderNumber,
                customer_id: data.customer_id,
                status: data.status || 'OPEN',
                start_date: data.start_date ? new Date(data.start_date) : null,
                end_date: data.end_date ? new Date(data.end_date) : null,
                custom_data: data.custom_data || null,
                department_id: data.department_id || null,
                item_id: data.item_id || null,
                custom_item: data.custom_item || null,
                order_qty: data.order_qty !== undefined && data.order_qty !== null ? Number(data.order_qty) : null,
                order_qty_unit: data.order_qty_unit || null,
                production_qty: data.production_qty !== undefined && data.production_qty !== null ? Number(data.production_qty) : null,
                production_qty_unit: data.production_qty_unit || null
            }
        });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'CREATE',
                entity_type: 'JobOrder',
                entity_id: order.id,
                company_id: tenantId,
                details: { order_number: order.order_number }
            }
        });
        res.status(201).json(order);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create job order', details: error.message });
    }
});
// Edit Job Order (Admin & Operations)
exports.jobOrdersRouter.put('/:id', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    const data = req.body;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const prevOrder = await prismaTenant.jobOrder.findUnique({ where: { id } });
        if (!prevOrder)
            return res.status(404).json({ error: 'Job order not found' });
        let updateData = {};
        if (req.user.role === 'OPERATIONS') {
            // 1. Lock closed/cancelled job orders for operations users
            if (prevOrder.status === 'COMPLETED' || prevOrder.status === 'CANCELLED' || prevOrder.status === 'CLOSED') {
                return res.status(403).json({ error: 'This job order is closed or cancelled and is locked for entries.' });
            }
            // 2. Allow operations to change status ONLY to COMPLETED, CANCELLED, or CLOSED
            if (data.status !== undefined && data.status !== prevOrder.status) {
                if (data.status !== 'COMPLETED' && data.status !== 'CANCELLED' && data.status !== 'CLOSED') {
                    return res.status(403).json({ error: 'Operations users are only allowed to mark job orders as Completed or Cancelled.' });
                }
                updateData.status = data.status;
            }
            // 3. Allow operations to update production qty ONLY. Do not allow changing production units.
            if (data.production_qty !== undefined) {
                updateData.production_qty = data.production_qty !== null ? Number(data.production_qty) : null;
            }
            if (data.production_qty_unit !== undefined && data.production_qty_unit !== prevOrder.production_qty_unit) {
                return res.status(403).json({ error: 'Operations users are not allowed to modify production units.' });
            }
            // 4. Do not allow operations users to modify custom columns.
            if (data.custom_data) {
                const prevCustom = prevOrder.custom_data || {};
                const newCustom = data.custom_data;
                for (const key of Object.keys(newCustom)) {
                    if (newCustom[key] !== prevCustom[key]) {
                        return res.status(403).json({ error: 'Operations users are not allowed to modify custom columns.' });
                    }
                }
                for (const key of Object.keys(prevCustom)) {
                    if (newCustom[key] === undefined && prevCustom[key] !== undefined) {
                        return res.status(403).json({ error: 'Operations users are not allowed to modify custom columns.' });
                    }
                }
                updateData.custom_data = data.custom_data;
            }
        }
        else {
            // Admins are allowed to update everything
            updateData = {
                order_number: data.order_number !== undefined ? data.order_number : undefined,
                customer_id: data.customer_id !== undefined ? data.customer_id : undefined,
                status: data.status !== undefined ? data.status : undefined,
                start_date: data.start_date !== undefined ? (data.start_date ? new Date(data.start_date) : null) : undefined,
                end_date: data.end_date !== undefined ? (data.end_date ? new Date(data.end_date) : null) : undefined,
                custom_data: data.custom_data !== undefined ? data.custom_data : undefined,
                department_id: data.department_id !== undefined ? data.department_id : undefined,
                item_id: data.item_id !== undefined ? data.item_id : undefined,
                custom_item: data.custom_item !== undefined ? data.custom_item : undefined,
                order_qty: data.order_qty !== undefined ? (data.order_qty !== null ? Number(data.order_qty) : null) : undefined,
                order_qty_unit: data.order_qty_unit !== undefined ? data.order_qty_unit : undefined,
                production_qty: data.production_qty !== undefined ? (data.production_qty !== null ? Number(data.production_qty) : null) : undefined,
                production_qty_unit: data.production_qty_unit !== undefined ? data.production_qty_unit : undefined
            };
        }
        const order = await prismaTenant.jobOrder.update({
            where: { id },
            data: updateData
        });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'EDIT',
                entity_type: 'JobOrder',
                entity_id: id,
                company_id: tenantId,
                details: {
                    before: { order_number: prevOrder.order_number, status: prevOrder.status },
                    after: { order_number: order.order_number, status: order.status }
                }
            }
        });
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update job order', details: error.message });
    }
});
// Delete Job Order (Admin only)
exports.jobOrdersRouter.delete('/:id', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const prevOrder = await prismaTenant.jobOrder.findUnique({ where: { id } });
        if (!prevOrder)
            return res.status(404).json({ error: 'Job order not found' });
        await prismaTenant.jobOrder.delete({ where: { id } });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'DELETE',
                entity_type: 'JobOrder',
                entity_id: id,
                company_id: tenantId,
                details: { order_number: prevOrder.order_number }
            }
        });
        res.json({ message: 'Job order deleted' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete job order', details: error.message });
    }
});
// Bulk delete Job Orders (Admin only)
exports.jobOrdersRouter.post('/bulk-delete', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const { ids } = req.body;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid request: ids array is required' });
    }
    try {
        const existing = await prismaTenant.jobOrder.findMany({
            where: { id: { in: ids }, company_id: tenantId }
        });
        if (existing.length === 0) {
            return res.status(404).json({ error: 'No matching job orders found' });
        }
        await prismaTenant.$transaction(async (tx) => {
            await tx.jobOrder.deleteMany({
                where: { id: { in: ids }, company_id: tenantId }
            });
            await tx.auditLogEntry.create({
                data: {
                    user_id: req.user.id,
                    action: 'DELETE',
                    entity_type: 'JobOrder',
                    entity_id: 'BULK_DELETE',
                    company_id: tenantId,
                    details: { deleted_ids: ids, order_numbers: existing.map(o => o.order_number) }
                }
            });
        });
        res.json({ message: 'Job orders bulk deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to bulk delete job orders', details: error.message });
    }
});
// GET Job Order Summary by order number string
exports.jobOrdersRouter.get('/by-number/:orderNumber/summary', async (req, res) => {
    const tenantId = req.tenantId;
    const orderNumber = req.params.orderNumber;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const order = await prismaTenant.jobOrder.findFirst({
            where: {
                order_number: { equals: orderNumber, mode: 'insensitive' },
                company_id: tenantId
            },
            include: {
                customer: { select: { name: true } }
            }
        });
        if (!order) {
            return res.status(404).json({ error: `Job order ${orderNumber} not found` });
        }
        // Now, find all ReportEntry logs that belong to this tenant
        const reportEntries = await prismaTenant.reportEntry.findMany({
            where: { company_id: tenantId },
            include: {
                format_version: { include: { format: { select: { id: true, name: true, type: true } } } },
                department: { select: { name: true } },
                submitter: { select: { email: true } }
            }
        });
        let totalProduced = 0;
        const productionLogs = [];
        const qualityLogs = [];
        const orderNumLower = order.order_number.toLowerCase().trim();
        for (const entry of reportEntries) {
            const payload = entry.payload || {};
            const keys = Object.keys(payload);
            // Look for a key that represents job order number
            const jobOrderKey = keys.find(k => {
                const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                return l.startsWith('joborder') || l === 'joborderno' || l === 'jobordernumber' || l === 'joborderid' || l === 'order';
            });
            if (jobOrderKey && payload[jobOrderKey]) {
                const entryVal = String(payload[jobOrderKey]).toLowerCase().trim();
                if (entryVal === orderNumLower) {
                    const isQuality = entry.format_version?.format?.type === 'QUALITY';
                    if (isQuality) {
                        qualityLogs.push({
                            id: entry.id,
                            date: entry.entry_date,
                            department: entry.department?.name || 'N/A',
                            format: {
                                id: entry.format_version?.format?.id || '',
                                name: entry.format_version?.format?.name || 'N/A',
                                type: 'QUALITY'
                            },
                            fieldsSchema: entry.format_version?.fields_schema || [],
                            submitter: entry.submitter?.email || 'N/A',
                            payload: payload
                        });
                    }
                    else {
                        // Extract production qty
                        const prodKey = keys.find(k => {
                            const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                            return l.startsWith('production') || l.startsWith('output') || l.startsWith('produced');
                        });
                        const productionQty = prodKey ? parseFloat(payload[prodKey]) : 0;
                        const parsedQty = isNaN(productionQty) ? 0 : productionQty;
                        totalProduced += parsedQty;
                        productionLogs.push({
                            id: entry.id,
                            date: entry.entry_date,
                            department: entry.department?.name || 'N/A',
                            format: {
                                id: entry.format_version?.format?.id || '',
                                name: entry.format_version?.format?.name || 'N/A',
                                type: entry.format_version?.format?.type || 'N/A'
                            },
                            fieldsSchema: entry.format_version?.fields_schema || [],
                            productionQty: parsedQty,
                            submitter: entry.submitter?.email || 'N/A',
                            payload: payload
                        });
                    }
                }
            }
        }
        const orderQty = order.order_qty !== null ? order.order_qty : 0;
        const balanceQty = orderQty - totalProduced;
        res.json({
            id: order.id,
            jobOrderNumber: order.order_number,
            clientName: order.customer.name,
            orderedQty: order.order_qty,
            orderedQtyUnit: order.order_qty_unit || '',
            totalProducedQty: totalProduced,
            balanceQty: balanceQty,
            productionLogs,
            qualityLogs
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch job order summary', details: error.message });
    }
});
