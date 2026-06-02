"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./db/prisma");
const sync_1 = require("./utils/sync");
async function main() {
    const companyId = '631f5ba6-7c09-4aea-9e41-a606e3c1ab80'; // crox
    console.log(`--- Scanning Database for Company crox (${companyId}) ---`);
    const tenantPrisma = (0, prisma_1.getTenantPrisma)(companyId);
    const entries = await tenantPrisma.reportEntry.findMany({
        include: {
            format_version: {
                include: { format: true }
            }
        }
    });
    console.log(`Found ${entries.length} Report Entries for crox.`);
    for (const entry of entries) {
        console.log(`\nEntry ID: ${entry.id}`);
        console.log(`Format: ${entry.format_version.format.name} (${entry.format_version.format.type})`);
        console.log(`Date: ${entry.entry_date}`);
        console.log('Payload:', JSON.stringify(entry.payload));
    }
    const productionRecords = await tenantPrisma.productionRecord.findMany({
        include: {
            operator: true,
            machine: true
        }
    });
    console.log(`\nFound ${productionRecords.length} Production Records in database:`);
    for (const rec of productionRecords) {
        console.log(`- ID: ${rec.id}, Date: ${rec.date}, Production: ${rec.production_amount}, Target: ${rec.target_amount}, Operator: ${rec.operator.name}, Machine: ${rec.machine.name}, Linked Entry: ${rec.report_entry_id}`);
    }
    // Let's run a test sync for all entries to see if any are missing or if it matches them
    console.log('\n--- Running test sync for all existing entries ---');
    await tenantPrisma.$transaction(async (tx) => {
        for (const entry of entries) {
            console.log(`Syncing entry ${entry.id}...`);
            await (0, sync_1.syncReportEntryToProduction)(tx, entry);
        }
    });
    const productionRecordsPost = await tenantPrisma.productionRecord.findMany({
        include: {
            operator: true,
            machine: true
        }
    });
    console.log(`\nFound ${productionRecordsPost.length} Production Records after sync:`);
    for (const rec of productionRecordsPost) {
        console.log(`- ID: ${rec.id}, Date: ${rec.date}, Production: ${rec.production_amount}, Target: ${rec.target_amount}, Operator: ${rec.operator.name}, Machine: ${rec.machine.name}, Linked Entry: ${rec.report_entry_id}`);
    }
}
main().catch(console.error).finally(() => prisma_1.prisma.$disconnect());
