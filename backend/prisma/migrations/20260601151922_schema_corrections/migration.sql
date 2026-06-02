/*
  Warnings:

  - Made the column `department_id` on table `ProductionRecord` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ProductionRecord" DROP CONSTRAINT "ProductionRecord_department_id_fkey";

-- AlterTable
ALTER TABLE "ProductionRecord" ALTER COLUMN "department_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ProductionRecord" ADD CONSTRAINT "ProductionRecord_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
