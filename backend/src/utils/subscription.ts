import { prisma } from '../db/prisma';

export type SubscriptionTier = 'STARTER' | 'GROWTH' | 'ENTERPRISE';

export interface TierLimit {
  manpower: number;
  machines: number;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimit> = {
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
export async function verifySubscriptionLimit(
  companyId: string,
  type: 'manpower' | 'machines',
  newCountToAdd: number = 1
): Promise<void> {
  // 1. Fetch the company's subscription tier
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscription_tier: true, name: true },
  });

  if (!company) {
    throw new Error('Company not found');
  }

  const tier = (company.subscription_tier || 'STARTER') as SubscriptionTier;
  const limit = TIER_LIMITS[tier]?.[type] ?? Infinity;

  if (limit === Infinity) {
    return; // Enterprise or custom unlimited
  }

  // 2. Count current records of this type for the company
  let currentCount = 0;
  if (type === 'manpower') {
    currentCount = await prisma.manpower.count({
      where: { company_id: companyId },
    });
  } else if (type === 'machines') {
    currentCount = await prisma.machine.count({
      where: { company_id: companyId },
    });
  }

  // 3. Verify if new additions exceed limits
  if (currentCount + newCountToAdd > limit) {
    const errorMsg = `Subscription limit reached for ${type}. Current: ${currentCount}, Limit: ${limit} under the ${tier} tier. Please upgrade your subscription to add more.`;
    const err: any = new Error(errorMsg);
    err.status = 403;
    throw err;
  }
}
