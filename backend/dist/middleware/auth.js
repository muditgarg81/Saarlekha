"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET environment variable is unset or shorter than 32 characters.");
}
const JWT_SECRET = process.env.JWT_SECRET;
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        // Resolve tenantId:
        // 1. For SUPER_ADMIN, honor the client-supplied x-tenant-id header if present
        // 2. For all other roles, always use their verified companyId from the JWT, ignoring any client headers
        if (decoded.role === 'SUPER_ADMIN') {
            if (req.headers['x-tenant-id']) {
                req.tenantId = req.headers['x-tenant-id'];
            }
        }
        else {
            if (decoded.companyId) {
                req.tenantId = decoded.companyId;
            }
        }
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
}
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
        }
        next();
    };
}
