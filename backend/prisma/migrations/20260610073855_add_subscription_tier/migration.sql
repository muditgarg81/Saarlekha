-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'GROWTH', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "subscription_tier" "SubscriptionTier" NOT NULL DEFAULT 'STARTER';
