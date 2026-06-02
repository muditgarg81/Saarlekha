"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./db/prisma");
async function main() {
    const companies = await prisma_1.prisma.company.findMany();
    console.log("Companies in DB:", companies.map(c => ({ id: c.id, name: c.name })));
    for (const company of companies) {
        const tenantPrisma = (0, prisma_1.getTenantPrisma)(company.id);
        const formats = await tenantPrisma.reportFormat.findMany({
            include: {
                versions: {
                    orderBy: { version_num: 'desc' },
                    take: 1
                }
            }
        });
        console.log(`Formats for company ${company.name} (${company.id}):`);
        console.log(JSON.stringify(formats, null, 2));
    }
}
main().catch(console.error).finally(() => prisma_1.prisma.$disconnect());
