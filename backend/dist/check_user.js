"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./db/prisma");
async function main() {
    const users = await prisma_1.prisma.user.findMany();
    console.log('Database Users:', users.map(u => ({ id: u.id, email: u.email, role: u.role })));
}
main().catch(console.error).finally(() => prisma_1.prisma.$disconnect());
