"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./db/prisma");
async function main() {
    const policies = await prisma_1.prisma.$queryRaw `
    SELECT schemaname::text, tablename::text, policyname::text, cmd::text, qual::text, with_check::text 
    FROM pg_policies
    WHERE schemaname = 'public';
  `;
    console.log('RLS Policies:');
    console.log(JSON.stringify(policies, null, 2));
}
main().catch(console.error).finally(() => prisma_1.prisma.$disconnect());
