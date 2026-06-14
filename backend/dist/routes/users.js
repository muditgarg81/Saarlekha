"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../db/prisma");
const bcrypt_1 = __importDefault(require("bcrypt"));
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
exports.usersRouter = (0, express_1.Router)();
// Only SUPER_ADMIN and COMPANY_ADMIN can access user management
exports.usersRouter.use(auth_1.authenticate, (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']));
exports.usersRouter.get('/', async (req, res) => {
    const tenantId = req.tenantId;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const users = await prismaTenant.user.findMany({
            where: {
                NOT: {
                    email: { startsWith: 'deleted_' }
                }
            },
            select: {
                id: true,
                email: true,
                role: true,
                created_at: true,
                departments: {
                    select: {
                        department: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
});
exports.usersRouter.put('/:id/departments', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { departmentIds } = req.body;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    if (!Array.isArray(departmentIds))
        return res.status(400).json({ error: 'departmentIds array is required' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        // Verify target user is an operations user (Admins shouldn't be assigned to specific departments usually, but keeping it flexible)
        const targetUser = await prismaTenant.user.findUnique({ where: { id } });
        if (!targetUser)
            return res.status(404).json({ error: 'User not found' });
        await prismaTenant.$transaction(async (tx) => {
            // Clear existing departments
            await tx.userDepartment.deleteMany({
                where: { user_id: id }
            });
            // Add new departments
            if (departmentIds.length > 0) {
                await tx.userDepartment.createMany({
                    data: departmentIds.map((deptId) => ({
                        user_id: id,
                        department_id: deptId
                    }))
                });
            }
            // Audit Log
            await tx.auditLogEntry.create({
                data: {
                    user_id: req.user.id,
                    action: 'EDIT',
                    entity_type: 'UserDepartments',
                    entity_id: id,
                    company_id: tenantId,
                    details: { newDepartments: departmentIds }
                }
            });
        });
        res.json({ message: 'User departments updated successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update user departments', details: error.message });
    }
});
exports.usersRouter.put('/:id/password', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { password } = req.body;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    if (!password)
        return res.status(400).json({ error: 'Password is required' });
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long and contain at least one letter and one number.' });
    }
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        const targetUser = await prismaTenant.user.findUnique({ where: { id } });
        if (!targetUser)
            return res.status(404).json({ error: 'User not found' });
        const hashedPassword = await bcrypt_1.default.hash(password, 12);
        await prismaTenant.user.update({
            where: { id },
            data: { password_hash: hashedPassword }
        });
        // Audit Log
        await prismaTenant.auditLogEntry.create({
            data: {
                user_id: req.user.id,
                action: 'EDIT',
                entity_type: 'UserPassword',
                entity_id: id,
                company_id: tenantId,
                details: { action: 'admin_password_change' }
            }
        });
        res.json({ message: 'User password updated successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update user password', details: error.message });
    }
});
// Create operations user (similar to invite, but just API skeleton if needed beyond the invite link)
// Delete user
exports.usersRouter.delete('/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    if (!tenantId)
        return res.status(403).json({ error: 'Tenant ID missing' });
    const prismaTenant = (0, prisma_1.getTenantPrisma)(tenantId);
    try {
        await prismaTenant.$transaction(async (tx) => {
            // 1. Delete user departments first
            await tx.userDepartment.deleteMany({
                where: { user_id: id }
            });
            // 2. Try hard delete the user
            await tx.user.delete({
                where: { id }
            });
        });
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        // If user has foreign key constraints (e.g. AuditLog, ReportEntry), perform soft-delete
        if (error.code === 'P2003' || error.message?.includes('foreign key')) {
            try {
                const user = await prismaTenant.user.findUnique({ where: { id } });
                if (user) {
                    // Rename email to free up original email and mark as deleted, nullify passwords
                    const deletedEmail = `deleted_${id}_${user.email}`;
                    await prismaTenant.user.update({
                        where: { id },
                        data: {
                            email: deletedEmail,
                            password_hash: null,
                            google_id: null
                        }
                    });
                    return res.json({ message: 'User deactivated and removed from lists successfully' });
                }
            }
            catch (innerErr) {
                return res.status(500).json({ error: 'Failed to deactivate user record', details: innerErr.message });
            }
        }
        res.status(500).json({ error: 'Failed to delete user', details: error.message });
    }
});
