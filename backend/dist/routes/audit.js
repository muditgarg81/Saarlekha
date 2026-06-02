"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../db/prisma");
exports.auditRouter = (0, express_1.Router)();
exports.auditRouter.use(auth_1.authenticate, (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']));
exports.auditRouter.get('/', async (req, res) => {
    const tenantId = req.tenantId;
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId, req.user?.role);
    const { page = '1', limit = '50', entity, action } = req.query;
    try {
        const where = {};
        if (entity)
            where.entity_type = entity;
        if (action)
            where.action = action;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [logs, total] = await Promise.all([
            prismaTenant.auditLogEntry.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip,
                take: parseInt(limit),
                include: {
                    user: { select: { email: true, role: true } }
                }
            }),
            prismaTenant.auditLogEntry.count({ where })
        ]);
        res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit log', details: error.message });
    }
});
