-- CreateTable
CREATE TABLE "TermUserDefaults" (
    "userId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "category" "ShoppingCategory",
    "unit" "ShoppingUnit",
    "qty" DOUBLE PRECISION,
    "extras" JSONB,

    CONSTRAINT "TermUserDefaults_pkey" PRIMARY KEY ("userId","termId")
);

-- CreateIndex
CREATE INDEX "TermUserDefaults_termId_idx" ON "TermUserDefaults"("termId");

-- AddForeignKey
ALTER TABLE "TermUserDefaults" ADD CONSTRAINT "TermUserDefaults_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermUserDefaults" ADD CONSTRAINT "TermUserDefaults_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
