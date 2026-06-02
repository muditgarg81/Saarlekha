"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../db/prisma");
async function main() {
    console.log("=== Querying Companies ===");
    const companies = await prisma_1.prisma.company.findMany();
    console.log(`Found ${companies.length} companies.`);
    for (const c of companies) {
        console.log(`\n--- Company: ${c.name} (ID: ${c.id}) ---`);
        // Set config parameter within transaction to bypass RLS restrictions per tenant
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${c.id}', true)`);
            const formats = await tx.reportFormat.findMany({
                include: {
                    versions: {
                        orderBy: { version_num: 'desc' }
                    }
                }
            });
            console.log(`Found ${formats.length} formats:`);
            for (const f of formats) {
                console.log(`- Format: ${f.name} (Type: ${f.type}, ID: ${f.id})`);
                console.log(`  Versions: ${f.versions.length}`);
                if (f.versions.length > 0) {
                    console.log(`  Latest Schema:`, JSON.stringify(f.versions[0].fields_schema));
                }
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
