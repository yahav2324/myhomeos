/*
  Warnings:

  - Made the column `expiresAt` on table `AuthSession` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "AuthSession" ALTER COLUMN "expiresAt" SET NOT NULL;
