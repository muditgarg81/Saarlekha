"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../db/prisma");
const sync_1 = require("../utils/sync");
exports.reportsRouter = (0, express_1.Router)();
exports.reportsRouter.use(auth_1.authenticate);
// 1. Report Formats (Builders)
exports.reportsRouter.get('/formats', async (req, res) => {
    const tenantId = req.tenantId;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const formats = await prismaTenant.reportFormat.findMany({
            include: {
                versions: {
                    orderBy: { version_num: 'desc' },
                    take: 1 // Get only the latest version schema for building
                }
            }
        });
        res.json(formats);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch formats', details: error.message });
    }
});
exports.reportsRouter.post('/formats', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const { name, type, initialFields } = req.body;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const result = await prismaTenant.$transaction(async (tx) => {
            // Prevent duplicates of system formats per company
            if (type === 'JOB_ORDER' || type === 'MAINTENANCE') {
                const existing = await tx.reportFormat.findFirst({
                    where: { type, company_id: tenantId },
                    include: {
                        versions: {
                            orderBy: { version_num: 'desc' },
                            take: 1
                        }
                    }
                });
                if (existing) {
                    return { format: existing, version: existing.versions[0] };
                }
            }
            const format = await tx.reportFormat.create({
                data: {
                    company_id: tenantId,
                    name,
                    type
                }
            });
            const version = await tx.reportFormatVersion.create({
                data: {
                    format_id: format.id,
                    version_num: 1,
                    fields_schema: initialFields || []
                }
            });
            await tx.auditLogEntry.create({
                data: {
                    user_id: req.user.id,
                    action: 'CREATE',
                    entity_type: 'ReportFormat',
                    entity_id: format.id,
                    company_id: tenantId,
                    details: { name, type }
                }
            });
            return { format, version };
        });
        res.status(201).json(result);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create format', details: error.message });
    }
});
// Create a new version of the format (Add-field, preserve old data)
exports.reportsRouter.post('/formats/:id/versions', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    const { fields } = req.body;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const latestVersion = await prismaTenant.reportFormatVersion.findFirst({
            where: { format_id: id },
            orderBy: { version_num: 'desc' }
        });
        const nextVersionNum = latestVersion ? latestVersion.version_num + 1 : 1;
        const newVersion = await prismaTenant.reportFormatVersion.create({
            data: {
                format_id: id,
                version_num: nextVersionNum,
                fields_schema: fields
            }
        });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'EDIT',
                entity_type: 'ReportFormatVersion',
                entity_id: newVersion.id,
                company_id: tenantId,
                details: { format_id: id, version_num: nextVersionNum }
            }
        });
        res.status(201).json(newVersion);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update format version', details: error.message });
    }
});
// Update a format name
exports.reportsRouter.put('/formats/:id', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    const { name } = req.body;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Format name is required.' });
    }
    try {
        const existing = await prismaTenant.reportFormat.findFirst({
            where: { id, company_id: tenantId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Report format not found' });
        }
        const updated = await prismaTenant.reportFormat.update({
            where: { id },
            data: { name: name.trim() }
        });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'EDIT',
                entity_type: 'ReportFormat',
                entity_id: id,
                company_id: tenantId,
                details: { before: { name: existing.name }, after: { name: updated.name } }
            }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update report format name', details: error.message });
    }
});
// Delete a format
exports.reportsRouter.delete('/formats/:id', (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const tenantId = req.tenantId;
    const id = req.params.id;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const versions = await prismaTenant.reportFormatVersion.findMany({
            where: { format_id: id }
        });
        const versionIds = versions.map(v => v.id);
        const hasEntries = await prismaTenant.reportEntry.findFirst({
            where: { format_version_id: { in: versionIds } }
        });
        if (hasEntries) {
            return res.status(400).json({
                error: 'Cannot delete format because it has existing data entries logged.'
            });
        }
        await prismaTenant.$transaction(async (tx) => {
            await tx.reportFormatVersion.deleteMany({ where: { format_id: id } });
            await tx.reportFormat.delete({ where: { id: id } });
        });
        res.json({ message: 'Report format deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete format', details: error.message });
    }
});
// GET /api/reports/formats/:formatId/last-value
exports.reportsRouter.get('/formats/:formatId/last-value', async (req, res) => {
    const tenantId = req.tenantId;
    const formatId = req.params.formatId;
    const { sourceFieldId, scopeFieldId, scopeValue } = req.query;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    if (!sourceFieldId) {
        return res.status(400).json({ error: 'sourceFieldId is required' });
    }
    try {
        const whereClause = {
            format_version: { format_id: formatId }
        };
        if (scopeFieldId && scopeValue !== undefined && scopeValue !== null && scopeValue !== '') {
            const stringValue = String(scopeValue);
            const numValue = Number(scopeValue);
            const isNum = !isNaN(numValue);
            const conditions = [
                {
                    payload: {
                        path: [scopeFieldId],
                        equals: stringValue
                    }
                }
            ];
            if (isNum) {
                conditions.push({
                    payload: {
                        path: [scopeFieldId],
                        equals: numValue
                    }
                });
            }
            whereClause.OR = conditions;
        }
        const lastEntry = await prismaTenant.reportEntry.findFirst({
            where: whereClause,
            orderBy: [
                { entry_date: 'desc' },
                { created_at: 'desc' }
            ]
        });
        if (!lastEntry) {
            return res.json({ value: null });
        }
        const payload = lastEntry.payload;
        const value = payload ? payload[sourceFieldId] : null;
        res.json({ value: value ?? null });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch last value', details: error.message });
    }
});
// 2. Report Entries (Data Entry)
exports.reportsRouter.get('/entries', async (req, res) => {
    const tenantId = req.tenantId;
    const { formatId, startDate, endDate, departmentId, type } = req.query;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const where = {};
        if (req.user.role === 'OPERATIONS') {
            const userDepts = await prismaTenant.userDepartment.findMany({
                where: { user_id: req.user.id },
                select: { department_id: true }
            });
            const allowed = userDepts.map(d => d.department_id);
            if (departmentId) {
                if (!allowed.includes(departmentId)) {
                    return res.status(403).json({ error: 'Forbidden: You are not assigned to this department.' });
                }
                where.department_id = departmentId;
            }
            else {
                where.department_id = { in: allowed };
            }
        }
        else {
            if (departmentId)
                where.department_id = departmentId;
        }
        if (startDate && endDate) {
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            where.entry_date = {
                gte: new Date(startDate),
                lte: end
            };
        }
        if (formatId) {
            where.format_version = { format_id: formatId };
        }
        // Filter by format type (e.g. QUALITY, GENERAL)
        if (type) {
            where.format_version = { ...where.format_version, format: { type: type } };
        }
        const entries = await prismaTenant.reportEntry.findMany({
            where,
            include: {
                format_version: {
                    include: { format: true }
                },
                submitter: { select: { email: true } },
                department: { select: { name: true } }
            }
        });
        res.json(entries);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch report entries', details: error.message });
    }
});
exports.reportsRouter.post('/entries', async (req, res) => {
    const tenantId = req.tenantId;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        if (Array.isArray(req.body)) {
            const createdEntries = await prismaTenant.$transaction(async (tx) => {
                const results = [];
                for (const item of req.body) {
                    const entry = await tx.reportEntry.create({
                        data: {
                            company_id: tenantId,
                            format_version_id: item.format_version_id,
                            department_id: item.department_id,
                            submitted_by: req.user.id,
                            entry_date: new Date(item.entry_date),
                            payload: item.payload
                        }
                    });
                    await (0, sync_1.syncReportEntryToProduction)(tx, entry);
                    results.push(entry);
                }
                return results;
            });
            return res.status(201).json({ count: createdEntries.length, entries: createdEntries });
        }
        const { format_version_id, department_id, entry_date, payload } = req.body;
        const entry = await prismaTenant.$transaction(async (tx) => {
            const e = await tx.reportEntry.create({
                data: {
                    company_id: tenantId,
                    format_version_id,
                    department_id,
                    submitted_by: req.user.id,
                    entry_date: new Date(entry_date),
                    payload
                }
            });
            await (0, sync_1.syncReportEntryToProduction)(tx, e);
            return e;
        });
        res.status(201).json(entry);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to submit report entry', details: error.message });
    }
});
exports.reportsRouter.get('/entries/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const entry = await prismaTenant.reportEntry.findFirst({
            where: { id, company_id: tenantId },
            include: {
                format_version: {
                    include: { format: true }
                },
                department: true
            }
        });
        if (!entry) {
            return res.status(404).json({ error: 'Report entry not found' });
        }
        if (req.user.role === 'OPERATIONS') {
            const userDepts = await prismaTenant.userDepartment.findMany({
                where: { user_id: req.user.id },
                select: { department_id: true }
            });
            const allowed = userDepts.map(d => d.department_id);
            if (!allowed.includes(entry.department_id)) {
                return res.status(403).json({ error: 'Forbidden: You are not assigned to this department.' });
            }
        }
        res.json(entry);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch report entry', details: error.message });
    }
});
exports.reportsRouter.put('/entries/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { payload, department_id, entry_date } = req.body;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const existing = await prismaTenant.reportEntry.findFirst({
            where: { id, company_id: tenantId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Report entry not found' });
        }
        if (req.user.role === 'OPERATIONS') {
            const userDepts = await prismaTenant.userDepartment.findMany({
                where: { user_id: req.user.id },
                select: { department_id: true }
            });
            const allowed = userDepts.map(d => d.department_id);
            if (!allowed.includes(existing.department_id)) {
                return res.status(403).json({ error: 'Forbidden: You are not assigned to this department.' });
            }
            if (department_id && !allowed.includes(department_id)) {
                return res.status(403).json({ error: 'Forbidden: You cannot assign entries to a department you are not assigned to.' });
            }
        }
        const updated = await prismaTenant.$transaction(async (tx) => {
            const u = await tx.reportEntry.update({
                where: { id },
                data: {
                    payload,
                    department_id: department_id || existing.department_id,
                    entry_date: entry_date ? new Date(entry_date) : existing.entry_date
                }
            });
            await (0, sync_1.syncReportEntryToProduction)(tx, u);
            return u;
        });
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'EDIT',
                entity_type: 'ReportEntry',
                entity_id: id,
                company_id: tenantId,
                details: { before: existing.payload, after: payload }
            }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update report entry', details: error.message });
    }
});
exports.reportsRouter.delete('/entries/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const existing = await prismaTenant.reportEntry.findFirst({
            where: { id, company_id: tenantId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Report entry not found' });
        }
        // Role-based check: OPERATIONS can only delete their own entries
        if (req.user?.role === 'OPERATIONS' && existing.submitted_by !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden: You can only delete your own report entries.' });
        }
        await prismaTenant.$transaction(async (tx) => {
            await tx.productionRecord.deleteMany({
                where: { report_entry_id: id }
            });
            await tx.reportEntry.delete({
                where: { id }
            });
            await tx.auditLogEntry.create({
                data: {
                    user_id: req.user.id,
                    action: 'DELETE',
                    entity_type: 'ReportEntry',
                    entity_id: id,
                    company_id: tenantId,
                    details: { deleted_payload: existing.payload }
                }
            });
            // Recalculate job order production quantity if applicable
            const payload = existing.payload;
            if (payload && typeof payload === 'object') {
                const joKey = Object.keys(payload).find(k => {
                    const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return l.startsWith('joborder') || l === 'joborderno' || l === 'jobordernumber' || l === 'joborderid' || l === 'order';
                });
                if (joKey && payload[joKey]) {
                    const jobOrderNumber = String(payload[joKey]).trim();
                    await (0, sync_1.syncJobOrderProduction)(tx, tenantId, jobOrderNumber);
                }
            }
        });
        res.json({ message: 'Report entry deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete report entry', details: error.message });
    }
});
// Bulk delete report entries
exports.reportsRouter.post('/entries/bulk-delete', async (req, res) => {
    const tenantId = req.tenantId;
    const { ids } = req.body;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid request: ids array is required' });
    }
    try {
        const existing = await prismaTenant.reportEntry.findMany({
            where: { id: { in: ids }, company_id: tenantId }
        });
        // Role-based check: OPERATIONS can only delete their own entries
        if (req.user?.role === 'OPERATIONS') {
            const unauthorized = existing.some(e => e.submitted_by !== req.user.id);
            if (unauthorized) {
                return res.status(403).json({ error: 'Forbidden: You can only delete your own report entries.' });
            }
        }
        await prismaTenant.$transaction(async (tx) => {
            // First delete associated production records to prevent referential integrity errors
            await tx.productionRecord.deleteMany({
                where: { report_entry_id: { in: ids } }
            });
            await tx.reportEntry.deleteMany({
                where: { id: { in: ids } }
            });
            await tx.auditLogEntry.create({
                data: {
                    user_id: req.user.id,
                    action: 'DELETE',
                    entity_type: 'ReportEntry',
                    entity_id: 'BULK_DELETE',
                    company_id: tenantId,
                    details: { deleted_ids: ids }
                }
            });
            // Recalculate job order production quantities for any affected job orders
            const affectedJobOrders = new Set();
            existing.forEach(e => {
                const payload = e.payload;
                if (payload && typeof payload === 'object') {
                    const joKey = Object.keys(payload).find(k => {
                        const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return l.startsWith('joborder') || l === 'joborderno' || l === 'jobordernumber' || l === 'joborderid' || l === 'order';
                    });
                    if (joKey && payload[joKey]) {
                        affectedJobOrders.add(String(payload[joKey]).trim());
                    }
                }
            });
            for (const joNum of affectedJobOrders) {
                await (0, sync_1.syncJobOrderProduction)(tx, tenantId, joNum);
            }
        });
        res.json({ message: 'Report entries deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to bulk delete report entries', details: error.message });
    }
});
