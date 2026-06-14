-- AlterTable
ALTER TABLE "ReportFormat" ADD COLUMN     "department_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
