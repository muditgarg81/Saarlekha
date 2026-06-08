"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./db/prisma");
async function main() {
    const tokens = await prisma_1.prisma.token.findMany({
        take: 10,
        orderBy: { created_at: 'desc' },
        include: { user: true }
    });
    console.log('--- Last 10 Tokens in Database ---');
    tokens.forEach((t, i) => {
        console.log(`${i + 1}. Token: ${t.token.substring(0, 8)}... Type: ${t.type} User: ${t.user?.email || 'N/A'} Created: ${t.created_at}`);
    });
}
main()
    .catch(e => console.error(e))
    .finally(() => prisma_1.prisma.$disconnect());
