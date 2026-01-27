-- CreateEnum
CREATE TYPE "TermStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TermScope" AS ENUM ('GLOBAL', 'PRIVATE');

-- CreateEnum
CREATE TYPE "VoteValue" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "json" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "scope" "TermScope" NOT NULL DEFAULT 'GLOBAL',
    "ownerUserId" TEXT,
    "status" "TermStatus" NOT NULL DEFAULT 'PENDING',
    "approvedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermTranslation" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermVote" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" "VoteValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "Term_status_idx" ON "Term"("status");

-- CreateIndex
CREATE INDEX "Term_scope_ownerUserId_idx" ON "Term"("scope", "ownerUserId");

-- CreateIndex
CREATE INDEX "TermTranslation_lang_normalized_idx" ON "TermTranslation"("lang", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "TermTranslation_termId_lang_key" ON "TermTranslation"("termId", "lang");

-- CreateIndex
CREATE INDEX "TermVote_termId_idx" ON "TermVote"("termId");

-- CreateIndex
CREATE INDEX "TermVote_userId_idx" ON "TermVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TermVote_termId_userId_key" ON "TermVote"("termId", "userId");

-- AddForeignKey
ALTER TABLE "TermTranslation" ADD CONSTRAINT "TermTranslation_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermVote" ADD CONSTRAINT "TermVote_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
