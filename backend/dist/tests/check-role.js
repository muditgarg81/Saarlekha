"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../db/prisma");
async function checkRole() {
    try {
        const roles = await prisma_1.prisma.$queryRaw `
      SELECT rolname, rolbypassrls, rolsuper 
      FROM pg_roles 
      WHERE rolname = current_user
    `;
        console.log('Current DB User Roles info:', roles);
    }
    catch (err) {
        console.error('Failed to query roles:', err);
    }
    process.exit(0);
}
checkRole();
