"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_LIMITS = void 0;
exports.verifySubscriptionLimit = verifySubscriptionLimit;
const prisma_1 = require("../db/prisma");
exports.TIER_LIMITS = {
    STARTER: {
        manpower: 30,
        machines: 5,
    },
    GROWTH: {
        manpower: 150,
        machines: 25,
    },
    ENTERPRISE: {
        manpower: Infinity,
        machines: Infinity,
    },
};
/**
 * Checks whether adding a certain number of resources will exceed the company's subscription tier limits.
 * Throws an error (with a clear message and a 403 status code if caught properly) if the limit is exceeded.
 */
async function verifySubscriptionLimit(companyId, type, newCountToAdd = 1) {
    // 1. Fetch the company's subscription tier
    const company = await prisma_1.prisma.company.findUnique({
        where: { id: companyId },
        select: { subscription_tier: true, name: true },
    });
    if (!company) {
        throw new Error('Company not found');
    }
    const tier = (company.subscription_tier || 'STARTER');
    const limit = exports.TIER_LIMITS[tier]?.[type] ?? Infinity;
    if (limit === Infinity) {
        return; // Enterprise or custom unlimited
    }
    // 2. Count current records of this type for the company
    let currentCount = 0;
    if (type === 'manpower') {
        currentCount = await prisma_1.prisma.manpower.count({
            where: { company_id: companyId },
        });
    }
    else if (type === 'machines') {
        currentCount = await prisma_1.prisma.machine.count({
            where: { company_id: companyId },
        });
    }
    // 3. Verify if new additions exceed limits
    if (currentCount + newCountToAdd > limit) {
        const errorMsg = `Subscription limit reached for ${type}. Current: ${currentCount}, Limit: ${limit} under the ${tier} tier. Please upgrade your subscription to add more.`;
        const err = new Error(errorMsg);
        err.status = 403;
        throw err;
    }
}
