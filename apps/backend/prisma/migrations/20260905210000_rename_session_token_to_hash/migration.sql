-- DropIndex
DROP INDEX "Session_sessionToken_idx";

-- DropIndex
DROP INDEX "Session_sessionToken_key";

-- AlterTable
ALTER TABLE "Session" RENAME COLUMN "sessionToken" TO "tokenHash";

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_tokenHash_idx" ON "Session"("tokenHash");
