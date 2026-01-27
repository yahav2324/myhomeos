/*
  Warnings:

  - Made the column `householdId` on table `Box` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Box_householdId_idx";

-- AlterTable
ALTER TABLE "Box" ALTER COLUMN "householdId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Box" ADD CONSTRAINT "Box_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
