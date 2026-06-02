"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../db/prisma");
const email_1 = require("../utils/email");
const google_auth_library_1 = require("google-auth-library");
const crypto_1 = __importDefault(require("crypto"));
exports.authRouter = (0, express_1.Router)();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET environment variable is unset or shorter than 32 characters.");
}
const JWT_SECRET = process.env.JWT_SECRET;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'placeholder';
const googleClient = new google_auth_library_1.OAuth2Client(GOOGLE_CLIENT_ID);
function generateRandomToken() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
// Password complexity: Minimum 8 characters, at least 1 letter and 1 number
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
// helper function to generate verify email link
async function sendVerificationEmail(user) {
    const tokenString = generateRandomToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await prisma_1.prisma.token.create({
        data: {
            token: tokenString,
            type: 'EMAIL_VERIFICATION',
            user_id: user.id,
            expires_at: expiresAt
        }
    });
    const verifyLink = `${APP_URL}/verify-email?token=${tokenString}`;
    await (0, email_1.sendEmail)({
        to: user.email,
        subject: 'Verify Your Email - Saarlekha',
        html: `
      <h2>Welcome to Saarlekha!</h2>
      <p>Thank you for registering. Please verify your email by clicking the link below:</p>
      <p><a href="${verifyLink}" style="padding: 10px 20px; background-color: #0059bb; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a></p>
      <p>Or copy and paste this URL into your browser:</p>
      <p>${verifyLink}</p>
      <p>This link is valid for 24 hours.</p>
    `,
        text: `Welcome to Saarlekha!\n\nPlease verify your email by clicking here: ${verifyLink}\n\nThis link is valid for 24 hours.`
    });
}
exports.authRouter.post('/register', async (req, res) => {
    const { email, password, companyName, companyAddress } = req.body;
    if (!email || !password || !companyName) {
        return res.status(400).json({ error: 'Email, password, and companyName are required' });
    }
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long and contain at least one letter and one number.' });
    }
    try {
        const existingUser = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT set_config('app.login_email', ${email}, true)`;
            return tx.user.findUnique({ where: { email }, include: { company: true } });
        });
        if (existingUser) {
            // Account-linking: If user signed up with Google (has google_id but no password_hash), we can set a password now
            if (existingUser.google_id && !existingUser.password_hash) {
                const hashedPassword = await bcrypt_1.default.hash(password, 12);
                const updatedUser = await prisma_1.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw `SELECT set_config('app.login_user_id', ${existingUser.id}, true)`;
                    return tx.user.update({
                        where: { id: existingUser.id },
                        data: {
                            password_hash: hashedPassword,
                            is_email_verified: true // Google accounts are verified
                        },
                        include: { company: true }
                    });
                });
                // Audit log
                await prisma_1.prisma.auditLogEntry.create({
                    data: {
                        user_id: updatedUser.id,
                        action: 'EDIT',
                        entity_type: 'User',
                        entity_id: updatedUser.id,
                        company_id: updatedUser.company_id,
                        details: { action: 'link_password_to_google' }
                    }
                });
                const token = jsonwebtoken_1.default.sign({ id: updatedUser.id, role: updatedUser.role, companyId: updatedUser.company_id }, JWT_SECRET, { expiresIn: '7d' });
                return res.status(200).json({
                    token,
                    user: {
                        id: updatedUser.id,
                        email: updatedUser.email,
                        role: updatedUser.role,
                        companyId: updatedUser.company_id,
                        companyName: updatedUser.company?.name
                    }
                });
            }
            else {
                return res.status(400).json({ error: 'User already exists' });
            }
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 12);
        // Create Company and Super Admin in a transaction
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const company = await tx.company.create({
                data: {
                    name: companyName,
                    address: companyAddress,
                }
            });
            const user = await tx.user.create({
                data: {
                    email,
                    password_hash: hashedPassword,
                    role: 'SUPER_ADMIN',
                    company_id: company.id,
                    is_email_verified: false,
                }
            });
            // Audit log
            await tx.auditLogEntry.create({
                data: {
                    user_id: user.id,
                    action: 'CREATE',
                    entity_type: 'Company',
                    entity_id: company.id,
                    company_id: company.id,
                    details: { name: company.name }
                }
            });
            return { company, user };
        });
        // Send verification email in background
        sendVerificationEmail(result.user).catch(err => console.error('Error sending verification email:', err));
        res.status(201).json({
            message: 'Registration successful! Please check your email to verify your account.',
            user: {
                id: result.user.id,
                email: result.user.email,
                role: result.user.role,
                companyId: result.company.id,
                companyName: result.company.name
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Registration failed', details: error.message });
    }
});
exports.authRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    try {
        const user = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT set_config('app.login_email', ${email}, true)`;
            return tx.user.findUnique({ where: { email }, include: { company: true } });
        });
        if (!user || !user.password_hash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isValid = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!user.is_email_verified) {
            return res.status(403).json({ error: 'Email not verified. Please check your inbox for a verification link.' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, companyId: user.company_id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, email: user.email, role: user.role, companyId: user.company_id, companyName: user.company?.name } });
    }
    catch (error) {
        res.status(500).json({ error: 'Login failed', details: error.message });
    }
});
exports.authRouter.post('/google', async (req, res) => {
    const { credential, companyName, companyAddress } = req.body;
    if (!credential) {
        return res.status(400).json({ error: 'Google credential (ID Token) is required' });
    }
    try {
        let email;
        let googleId;
        if ((credential === 'mock-google-token' || credential.startsWith('mock_')) && process.env.NODE_ENV !== 'production') {
            email = req.body.email || 'mock-google-user@example.com';
            googleId = 'mock-google-id-' + email;
        }
        else {
            if (credential === 'mock-google-token' || credential.startsWith('mock_')) {
                return res.status(400).json({ error: 'Mock authentication is disabled in production.' });
            }
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (!payload || !payload.email || !payload.sub) {
                return res.status(400).json({ error: 'Invalid Google token' });
            }
            email = payload.email;
            googleId = payload.sub;
        }
        // Check if user exists by google_id or email
        let user = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT set_config('app.login_email', ${email}, true)`;
            await tx.$executeRaw `SELECT set_config('app.login_google_id', ${googleId}, true)`;
            return tx.user.findFirst({
                where: {
                    OR: [
                        { google_id: googleId },
                        { email: email }
                    ]
                },
                include: { company: true }
            });
        });
        if (user) {
            // If user exists by email but google_id is not set, link it
            if (!user.google_id) {
                user = await prisma_1.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw `SELECT set_config('app.login_user_id', ${user.id}, true)`;
                    return tx.user.update({
                        where: { id: user.id },
                        data: {
                            google_id: googleId,
                            is_email_verified: true // Google emails are pre-verified
                        },
                        include: { company: true }
                    });
                });
            }
        }
        else {
            // User does not exist. Are they registering a new company?
            if (companyName) {
                user = await prisma_1.prisma.$transaction(async (tx) => {
                    const company = await tx.company.create({
                        data: {
                            name: companyName,
                            address: companyAddress,
                        }
                    });
                    const newUser = await tx.user.create({
                        data: {
                            email,
                            google_id: googleId,
                            role: 'SUPER_ADMIN',
                            company_id: company.id,
                            is_email_verified: true,
                        },
                        include: { company: true }
                    });
                    await tx.auditLogEntry.create({
                        data: {
                            user_id: newUser.id,
                            action: 'CREATE',
                            entity_type: 'Company',
                            entity_id: company.id,
                            company_id: company.id,
                            details: { name: company.name, via: 'Google' }
                        }
                    });
                    return newUser;
                });
            }
            else {
                // Not registering and no account. Return error so frontend can redirect or prompt
                return res.status(404).json({
                    error: 'No account associated with this Google email. Please register your company first, or ensure you have been invited.'
                });
            }
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, companyId: user.company_id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, email: user.email, role: user.role, companyId: user.company_id, companyName: user.company?.name } });
    }
    catch (error) {
        res.status(500).json({ error: 'Google authentication failed', details: error.message });
    }
});
exports.authRouter.post('/verify-email', async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ error: 'Token is required' });
    }
    try {
        const tokenRecord = await prisma_1.prisma.token.findUnique({
            where: { token }
        });
        if (!tokenRecord) {
            return res.status(400).json({ error: 'Invalid verification token' });
        }
        if (tokenRecord.type !== 'EMAIL_VERIFICATION') {
            return res.status(400).json({ error: 'Invalid token type for email verification' });
        }
        if (tokenRecord.used_at) {
            return res.status(400).json({ error: 'Token has already been used' });
        }
        if (new Date() > tokenRecord.expires_at) {
            return res.status(400).json({ error: 'Token has expired' });
        }
        if (!tokenRecord.user_id) {
            return res.status(400).json({ error: 'No user associated with this token' });
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT set_config('app.login_user_id', ${tokenRecord.user_id}, true)`;
            await tx.user.update({
                where: { id: tokenRecord.user_id },
                data: { is_email_verified: true }
            });
            await tx.token.update({
                where: { id: tokenRecord.id },
                data: { used_at: new Date() }
            });
        });
        res.json({ message: 'Email verified successfully!' });
    }
    catch (error) {
        res.status(400).json({ error: 'Verification failed', details: error.message });
    }
});
exports.authRouter.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    try {
        const user = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT set_config('app.login_email', ${email}, true)`;
            return tx.user.findUnique({ where: { email } });
        });
        // To prevent user enumeration, we return success even if user doesn't exist
        if (!user) {
            return res.json({ message: 'If that email is registered, we have sent a reset link.' });
        }
        const tokenString = generateRandomToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await prisma_1.prisma.token.create({
            data: {
                token: tokenString,
                type: 'PASSWORD_RESET',
                user_id: user.id,
                expires_at: expiresAt
            }
        });
        const resetLink = `${APP_URL}/reset-password?token=${tokenString}`;
        await (0, email_1.sendEmail)({
            to: email,
            subject: 'Reset Your Password - Saarlekha',
            html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset. Please click the link below to set a new password:</p>
        <p><a href="${resetLink}" style="padding: 10px 20px; background-color: #0059bb; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>${resetLink}</p>
        <p>This link is valid for 1 hour.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
            text: `Password Reset Request\n\nPlease click here to reset your password: ${resetLink}\n\nThis link is valid for 1 hour.`
        });
        res.json({ message: 'If that email is registered, we have sent a reset link.' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to request password reset', details: error.message });
    }
});
exports.authRouter.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ error: 'Token and password are required' });
    }
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long and contain at least one letter and one number.' });
    }
    try {
        const tokenRecord = await prisma_1.prisma.token.findUnique({
            where: { token }
        });
        if (!tokenRecord) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        if (tokenRecord.type !== 'PASSWORD_RESET') {
            return res.status(400).json({ error: 'Invalid token type for password reset' });
        }
        if (tokenRecord.used_at) {
            return res.status(400).json({ error: 'Token has already been used' });
        }
        if (new Date() > tokenRecord.expires_at) {
            return res.status(400).json({ error: 'Token has expired' });
        }
        if (!tokenRecord.user_id) {
            return res.status(400).json({ error: 'No user associated with this token' });
        }
        const user = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT set_config('app.login_user_id', ${tokenRecord.user_id}, true)`;
            return tx.user.findUnique({ where: { id: tokenRecord.user_id }, include: { company: true } });
        });
        if (!user) {
            return res.status(400).json({ error: 'No user associated with this token' });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 12);
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT set_config('app.login_user_id', ${tokenRecord.user_id}, true)`;
            await tx.user.update({
                where: { id: tokenRecord.user_id },
                data: { password_hash: hashedPassword }
            });
            await tx.token.update({
                where: { id: tokenRecord.id },
                data: { used_at: new Date() }
            });
            await tx.auditLogEntry.create({
                data: {
                    user_id: tokenRecord.user_id,
                    action: 'EDIT',
                    entity_type: 'User',
                    entity_id: tokenRecord.user_id,
                    company_id: user.company_id,
                    details: { field: 'password', action: 'reset' }
                }
            });
        });
        res.json({ message: 'Password reset successfully!' });
    }
    catch (error) {
        res.status(400).json({ error: 'Invalid or expired token', details: error.message });
    }
});
exports.authRouter.post('/setup-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ error: 'Token and password are required' });
    }
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long and contain at least one letter and one number.' });
    }
    try {
        const tokenRecord = await prisma_1.prisma.token.findUnique({
            where: { token }
        });
        if (!tokenRecord) {
            return res.status(400).json({ error: 'Invalid or expired invitation token' });
        }
        if (tokenRecord.type !== 'INVITE') {
            return res.status(400).json({ error: 'Invalid token type for invitation setup' });
        }
        if (tokenRecord.used_at) {
            return res.status(400).json({ error: 'Token has already been used' });
        }
        if (new Date() > tokenRecord.expires_at) {
            return res.status(400).json({ error: 'Token has expired' });
        }
        if (!tokenRecord.user_id) {
            return res.status(400).json({ error: 'No user associated with this token' });
        }
        const user = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT set_config('app.login_user_id', ${tokenRecord.user_id}, true)`;
            return tx.user.findUnique({ where: { id: tokenRecord.user_id }, include: { company: true } });
        });
        if (!user) {
            return res.status(400).json({ error: 'No user associated with this token' });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 12);
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT set_config('app.login_user_id', ${user.id}, true)`;
            await tx.user.update({
                where: { id: user.id },
                data: {
                    password_hash: hashedPassword,
                    is_email_verified: true
                }
            });
            await tx.token.update({
                where: { id: tokenRecord.id },
                data: { used_at: new Date() }
            });
            await tx.auditLogEntry.create({
                data: {
                    user_id: user.id,
                    action: 'EDIT',
                    entity_type: 'User',
                    entity_id: user.id,
                    company_id: user.company_id,
                    details: { field: 'password', action: 'setup_invite' }
                }
            });
        });
        // Automatically issue login token
        const sessionToken = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, companyId: user.company_id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            message: 'Password configured successfully!',
            token: sessionToken,
            user: { id: user.id, email: user.email, role: user.role, companyId: user.company_id, companyName: user.company?.name }
        });
    }
    catch (error) {
        res.status(400).json({ error: 'Invalid or expired invitation token', details: error.message });
    }
});
exports.authRouter.post('/invite', auth_1.authenticate, (0, auth_1.requireRole)(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req, res) => {
    const { email, departmentIds, role } = req.body;
    const companyId = req.tenantId;
    const targetRole = role || 'OPERATIONS';
    if (!['COMPANY_ADMIN', 'OPERATIONS'].includes(targetRole)) {
        return res.status(400).json({ error: 'Invalid role specified for invitation.' });
    }
    if (req.user.role === 'COMPANY_ADMIN' && targetRole !== 'OPERATIONS') {
        return res.status(403).json({ error: 'Company Admins are only allowed to invite Operations users.' });
    }
    if (targetRole === 'OPERATIONS' && (!departmentIds || !Array.isArray(departmentIds))) {
        return res.status(400).json({ error: 'departmentIds array is required' });
    }
    if (!email || !companyId) {
        return res.status(400).json({ error: 'Email and companyId are required' });
    }
    try {
        const prismaTenant = (0, prisma_1.getTenantPrisma)(companyId, req.user?.role);
        const existingUser = await prismaTenant.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const user = await prismaTenant.user.create({
            data: {
                email,
                role: targetRole,
                company_id: companyId,
                departments: targetRole === 'OPERATIONS' ? {
                    create: departmentIds.map((deptId) => ({
                        department_id: deptId
                    }))
                } : undefined
            }
        });
        const tokenString = generateRandomToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await prismaTenant.token.create({
            data: {
                token: tokenString,
                type: 'INVITE',
                user_id: user.id,
                expires_at: expiresAt
            }
        });
        const inviteLink = `${APP_URL}/setup-password?token=${tokenString}`;
        await (0, email_1.sendEmail)({
            to: email,
            subject: 'Invitation to join Saarlekha',
            html: `
        <h2>Welcome to Saarlekha!</h2>
        <p>You have been invited to join the platform as a ${targetRole.replace('_', ' ').toLowerCase()} user.</p>
        <p>Please click the link below to configure your password and activate your account:</p>
        <p><a href="${inviteLink}" style="padding: 10px 20px; background-color: #0059bb; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Configure Account</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>${inviteLink}</p>
        <p>This link is valid for 24 hours.</p>
      `,
            text: `Invitation to join Saarlekha\n\nPlease configure your password by clicking here: ${inviteLink}\n\nThis link is valid for 24 hours.`
        });
        res.json({
            message: 'Invite created and sent successfully',
            inviteLink,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                companyId: user.company_id
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create invite', details: error.message });
    }
});
