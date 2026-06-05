"use strict";
/**
 * Saarlekha — Report Entry Synchronization
 * Checks if a ReportEntry contains production data and synchronizes it with the ProductionRecord table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncReportEntryToProduction = syncReportEntryToProduction;
exports.syncJobOrderProduction = syncJobOrderProduction;
exports.syncAllJobOrdersProduction = syncAllJobOrdersProduction;
/**
 * Synchronizes a ReportEntry with the ProductionRecord table if it contains production data.
 */
async function syncReportEntryToProduction(tx, // Prisma transactional client
entry) {
    const payload = entry.payload;
    if (!payload || typeof payload !== 'object')
        return;
    const keys = Object.keys(payload);
    // Look for production amount key
    const prodKey = keys.find(k => {
        const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return l.startsWith('production') || l.startsWith('output') || l.startsWith('produced');
    });
    // Look for target amount key
    const targetKey = keys.find(k => {
        const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return l.startsWith('target');
    });
    // If we don't have production or target, clean up any existing linked ProductionRecord and exit
    if (!prodKey && !targetKey) {
        await tx.productionRecord.deleteMany({
            where: { report_entry_id: entry.id }
        });
        return;
    }
    // Look for operator key
    const opKey = keys.find(k => {
        const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return l.startsWith('operator') || l === 'person' || l === 'staff';
    });
    // Look for machine key
    const machineKey = keys.find(k => {
        const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return l.startsWith('machine') || l.startsWith('loom');
    });
    // Resolve values
    const productionAmount = prodKey ? parseFloat(payload[prodKey]) : 0;
    const targetAmount = targetKey ? parseFloat(payload[targetKey]) : 0;
    if (isNaN(productionAmount) && isNaN(targetAmount))
        return;
    // Find operator record by name
    let operatorId = null;
    if (opKey && payload[opKey]) {
        const opName = String(payload[opKey]).trim();
        const opRecord = await tx.manpower.findFirst({
            where: {
                company_id: entry.company_id,
                name: { equals: opName, mode: 'insensitive' }
            }
        });
        if (opRecord) {
            operatorId = opRecord.id;
        }
    }
    // Find machine record by name
    let machineId = null;
    if (machineKey && payload[machineKey]) {
        const machineName = String(payload[machineKey]).trim();
        const machineRecord = await tx.machine.findFirst({
            where: {
                company_id: entry.company_id,
                name: { equals: machineName, mode: 'insensitive' }
            }
        });
        if (machineRecord) {
            machineId = machineRecord.id;
        }
    }
    // We need BOTH operator and machine to create a valid ProductionRecord
    if (!operatorId || !machineId) {
        await tx.productionRecord.deleteMany({
            where: { report_entry_id: entry.id }
        });
        return;
    }
    // Upsert the ProductionRecord
    const existing = await tx.productionRecord.findUnique({
        where: { report_entry_id: entry.id }
    });
    if (existing) {
        await tx.productionRecord.update({
            where: { id: existing.id },
            data: {
                date: entry.entry_date,
                production_amount: productionAmount,
                target_amount: targetAmount,
                operator_id: operatorId,
                machine_id: machineId,
                department_id: entry.department_id
            }
        });
    }
    else {
        await tx.productionRecord.create({
            data: {
                company_id: entry.company_id,
                date: entry.entry_date,
                production_amount: productionAmount,
                target_amount: targetAmount,
                operator_id: operatorId,
                machine_id: machineId,
                report_entry_id: entry.id,
                department_id: entry.department_id
            }
        });
    }
    // Recalculate and sync job order production quantity if applicable
    const jobOrderKey = keys.find(k => {
        const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return l.startsWith('joborder') || l === 'joborderno' || l === 'jobordernumber' || l === 'joborderid' || l === 'order';
    });
    if (jobOrderKey && payload[jobOrderKey]) {
        const jobOrderNumber = String(payload[jobOrderKey]).trim();
        await syncJobOrderProduction(tx, entry.company_id, jobOrderNumber);
    }
}
async function syncJobOrderProduction(tx, companyId, jobOrderNumber) {
    const jobOrder = await tx.jobOrder.findFirst({
        where: {
            company_id: companyId,
            order_number: { equals: jobOrderNumber.trim(), mode: 'insensitive' }
        }
    });
    if (!jobOrder)
        return;
    const allEntries = await tx.reportEntry.findMany({
        where: { company_id: companyId },
        include: {
            format_version: {
                include: {
                    format: { select: { type: true } }
                }
            }
        }
    });
    let totalProduced = 0;
    for (const ent of allEntries) {
        const p = ent.payload;
        if (!p || typeof p !== 'object')
            continue;
        if (ent.format_version?.format?.type === 'QUALITY')
            continue;
        const joKey = Object.keys(p).find(k => {
            const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            return l.startsWith('joborder') || l === 'joborderno' || l === 'jobordernumber' || l === 'joborderid' || l === 'order';
        });
        if (joKey && p[joKey]) {
            const entryVal = String(p[joKey]).toLowerCase().trim();
            if (entryVal === jobOrder.order_number.toLowerCase().trim()) {
                const pKey = Object.keys(p).find(k => {
                    const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return l.startsWith('production') || l.startsWith('output') || l.startsWith('produced');
                });
                const qty = pKey ? parseFloat(p[pKey]) : 0;
                if (!isNaN(qty)) {
                    totalProduced += qty;
                }
            }
        }
    }
    await tx.jobOrder.update({
        where: { id: jobOrder.id },
        data: { production_qty: totalProduced }
    });
}
async function syncAllJobOrdersProduction(tx, companyId) {
    const jobOrders = await tx.jobOrder.findMany({
        where: { company_id: companyId }
    });
    if (jobOrders.length === 0)
        return;
    const allEntries = await tx.reportEntry.findMany({
        where: { company_id: companyId },
        include: {
            format_version: {
                include: {
                    format: { select: { type: true } }
                }
            }
        }
    });
    const productionSums = {};
    jobOrders.forEach((jo) => {
        productionSums[jo.order_number.toLowerCase().trim()] = 0;
    });
    for (const ent of allEntries) {
        const p = ent.payload;
        if (!p || typeof p !== 'object')
            continue;
        if (ent.format_version?.format?.type === 'QUALITY')
            continue;
        const joKey = Object.keys(p).find(k => {
            const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            return l.startsWith('joborder') || l === 'joborderno' || l === 'jobordernumber' || l === 'joborderid' || l === 'order';
        });
        if (joKey && p[joKey]) {
            const entryVal = String(p[joKey]).toLowerCase().trim();
            if (productionSums[entryVal] !== undefined) {
                const pKey = Object.keys(p).find(k => {
                    const l = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return l.startsWith('production') || l.startsWith('output') || l.startsWith('produced');
                });
                const qty = pKey ? parseFloat(p[pKey]) : 0;
                if (!isNaN(qty)) {
                    productionSums[entryVal] += qty;
                }
            }
        }
    }
    for (const jo of jobOrders) {
        const orderNumLower = jo.order_number.toLowerCase().trim();
        const computedQty = productionSums[orderNumLower] || 0;
        if (jo.production_qty !== computedQty) {
            await tx.jobOrder.update({
                where: { id: jo.id },
                data: { production_qty: computedQty }
            });
        }
    }
}
