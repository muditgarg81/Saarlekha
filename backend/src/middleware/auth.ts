import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET environment variable is unset or shorter than 32 characters.");
}
const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthUser {
  id: string;
  role: string;
  companyId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantId?: string;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    
    // Resolve tenantId:
    // 1. For SUPER_ADMIN, honor the client-supplied x-tenant-id header if present
    // 2. For all other roles, always use their verified companyId from the JWT, ignoring any client headers
    if (decoded.role === 'SUPER_ADMIN') {
      if (req.headers['x-tenant-id']) {
        req.tenantId = req.headers['x-tenant-id'] as string;
      }
    } else {
      if (decoded.companyId) {
        req.tenantId = decoded.companyId;
      }
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
    }
    next();
  };
}
