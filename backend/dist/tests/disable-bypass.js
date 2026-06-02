"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../db/prisma");
async function disableBypass() {
    try {
        console.log('Attempting to disable BYPASSRLS for neondb_owner...');
        await prisma_1.prisma.$executeRawUnsafe(`ALTER ROLE neondb_owner NOBYPASSRLS;`);
        console.log('✓ Successfully altered role to NOBYPASSRLS!');
    }
    catch (err) {
        console.error('✗ Failed to alter role:', err);
    }
    process.exit(0);
}
disableBypass();
