"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../db/prisma");
const sync_1 = require("../utils/sync");
async function runSyncTests() {
    console.log('Starting Report Entry Sync to Production Tests...');
    let success = true;
    // Set up the company ID context
    // Find or create test company
    let company = await prisma_1.prisma.company.findFirst({
        where: { name: 'Test Sync Company' }
    });
    if (!company) {
        company = await prisma_1.prisma.company.create({
            data: { name: 'Test Sync Company', address: '123 Sync St' }
        });
    }
    const companyId = company.id;
    const tenantPrisma = (0, prisma_1.getTenantPrisma)(companyId);
    // Set up test data using owner client or tenantPrisma
    console.log('Finding or creating test prerequisites...');
    // Find or create department
    let dept = await tenantPrisma.department.findFirst({
        where: { name: 'Loom' }
    });
    if (!dept) {
        dept = await tenantPrisma.department.create({
            data: { name: 'Loom', company_id: companyId }
        });
    }
    // Find or create user/submitter
    let user = await prisma_1.prisma.user.findFirst({
        where: { email: 'muditgarg81@gmail.com' }
    });
    if (!user) {
        user = await prisma_1.prisma.user.create({
            data: {
                email: 'muditgarg81@gmail.com',
                role: 'SUPER_ADMIN',
                company_id: companyId,
                is_email_verified: true
            }
        });
    }
    // Find or create manpower (Operator)
    let operator = await tenantPrisma.manpower.findFirst({
        where: { name: 'Test Operator' }
    });
    if (!operator) {
        operator = await tenantPrisma.manpower.create({
            data: {
                name: 'Test Operator',
                company_id: companyId,
                department_id: dept.id
            }
        });
    }
    // Find or create machine
    let machine = await tenantPrisma.machine.findFirst({
        where: { name: 'Test Machine Loom' }
    });
    if (!machine) {
        machine = await tenantPrisma.machine.create({
            data: {
                name: 'Test Machine Loom',
                company_id: companyId
            }
        });
    }
    // Find or create report format & version
    let format = await tenantPrisma.reportFormat.findFirst({
        where: { name: 'Test Production Report' }
    });
    if (!format) {
        format = await tenantPrisma.reportFormat.create({
            data: {
                name: 'Test Production Report',
                type: 'GENERAL',
                company_id: companyId
            }
        });
    }
    let version = await tenantPrisma.reportFormatVersion.findFirst({
        where: { format_id: format.id }
    });
    if (!version) {
        version = await tenantPrisma.reportFormatVersion.create({
            data: {
                format_id: format.id,
                version_num: 1,
                fields_schema: []
            }
        });
    }
    try {
        // 1. Create a Report Entry
        console.log('\n--- Test 1: Creating Report Entry ---');
        const payload = {
            "Target": 1500,
            "Loom No.": "Test Machine Loom",
            "Production": 1250,
            "Operator": "Test Operator"
        };
        const entry = await tenantPrisma.$transaction(async (tx) => {
            const e = await tx.reportEntry.create({
                data: {
                    company_id: companyId,
                    format_version_id: version.id,
                    department_id: dept.id,
                    submitted_by: user.id,
                    entry_date: new Date(),
                    payload
                }
            });
            await (0, sync_1.syncReportEntryToProduction)(tx, e);
            return e;
        });
        console.log(`Report Entry created with ID: ${entry.id}`);
        // Verify ProductionRecord was created
        const prodRecord = await tenantPrisma.productionRecord.findUnique({
            where: { report_entry_id: entry.id },
            include: { operator: true, machine: true }
        });
        if (prodRecord) {
            console.log('✓ SUCCESS: ProductionRecord automatically created.');
            console.log(`- Production: ${prodRecord.production_amount} (Expected: 1250)`);
            console.log(`- Target: ${prodRecord.target_amount} (Expected: 1500)`);
            console.log(`- Operator: ${prodRecord.operator.name} (Expected: Test Operator)`);
            console.log(`- Machine: ${prodRecord.machine.name} (Expected: Test Machine Loom)`);
            if (prodRecord.production_amount === 1250 && prodRecord.target_amount === 1500 &&
                prodRecord.operator.name === 'Test Operator' && prodRecord.machine.name === 'Test Machine Loom') {
                console.log('✓ SUCCESS: ProductionRecord fields match correctly.');
            }
            else {
                console.error('✗ FAILURE: ProductionRecord fields mismatch.');
                success = false;
            }
        }
        else {
            console.error('✗ FAILURE: ProductionRecord was not created.');
            success = false;
        }
        // 2. Update the Report Entry
        console.log('\n--- Test 2: Updating Report Entry ---');
        const updatedPayload = {
            "Target": 1500,
            "Loom No.": "Test Machine Loom",
            "Production": 1400, // Changed from 1250
            "Operator": "Test Operator"
        };
        const updatedEntry = await tenantPrisma.$transaction(async (tx) => {
            const u = await tx.reportEntry.update({
                where: { id: entry.id },
                data: { payload: updatedPayload }
            });
            await (0, sync_1.syncReportEntryToProduction)(tx, u);
            return u;
        });
        console.log(`Report Entry updated with ID: ${updatedEntry.id}`);
        // Verify ProductionRecord was updated
        const updatedProdRecord = await tenantPrisma.productionRecord.findUnique({
            where: { report_entry_id: entry.id }
        });
        if (updatedProdRecord) {
            console.log(`- Updated Production: ${updatedProdRecord.production_amount} (Expected: 1400)`);
            if (updatedProdRecord.production_amount === 1400) {
                console.log('✓ SUCCESS: ProductionRecord successfully updated.');
            }
            else {
                console.error('✗ FAILURE: ProductionRecord was not updated with new value.');
                success = false;
            }
        }
        else {
            console.error('✗ FAILURE: Linked ProductionRecord disappeared on update.');
            success = false;
        }
        // 3. Delete the Report Entry
        console.log('\n--- Test 3: Deleting Report Entry ---');
        await tenantPrisma.$transaction(async (tx) => {
            await tx.productionRecord.deleteMany({
                where: { report_entry_id: entry.id }
            });
            await tx.reportEntry.delete({
                where: { id: entry.id }
            });
        });
        console.log('Report Entry deleted.');
        // Verify ProductionRecord was deleted
        const deletedProdRecord = await tenantPrisma.productionRecord.findUnique({
            where: { report_entry_id: entry.id }
        });
        if (!deletedProdRecord) {
            console.log('✓ SUCCESS: Associated ProductionRecord was also deleted.');
        }
        else {
            console.error('✗ FAILURE: ProductionRecord was not deleted.');
            success = false;
        }
        // Cleanup other test resources
        console.log('\nCleaning up prerequisite test resources...');
        await tenantPrisma.manpower.delete({ where: { id: operator.id } });
        await tenantPrisma.machine.delete({ where: { id: machine.id } });
        await tenantPrisma.reportFormatVersion.delete({ where: { id: version.id } });
        await tenantPrisma.reportFormat.delete({ where: { id: format.id } });
        console.log('Cleanup completed.');
    }
    catch (err) {
        console.error('Test run failed with error:', err);
        success = false;
    }
    if (success) {
        console.log('\n=========================================');
        console.log('ALL SYNC TO PRODUCTION TESTS PASSED! 🎉');
        console.log('=========================================');
        process.exit(0);
    }
    else {
        console.error('\n=========================================');
        console.error('SOME SYNC TESTS FAILED! ✗');
        console.error('=========================================');
        process.exit(1);
    }
}
runSyncTests();
