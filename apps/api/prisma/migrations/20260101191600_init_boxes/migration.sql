-- CreateEnum
CREATE TYPE "BoxState" AS ENUM ('OK', 'LOW', 'EMPTY');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('g', 'ml');

-- CreateTable
CREATE TABLE "Box" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "capacity" DOUBLE PRECISION,
    "fullQuantity" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "state" "BoxState" NOT NULL DEFAULT 'EMPTY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Box_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Box_code_key" ON "Box"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Box_deviceId_key" ON "Box"("deviceId");
