"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../db/prisma");
async function main() {
    const formatId = '6418d95e-576e-4cff-9021-f55f23a56004';
    console.log(`Checking format with ID: ${formatId} across all tenants`);
    const companies = await prisma_1.prisma.company.findMany();
    for (const c of companies) {
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${c.id}', true)`);
            const format = await tx.reportFormat.findUnique({
                where: { id: formatId },
                include: {
                    versions: {
                        orderBy: { version_num: 'desc' }
                    }
                }
            });
            if (format) {
                console.log(`FOUND format under company ${c.name} (${c.id}):`, format);
            }
        });
    }
}
main()
    .catch(e => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
