-- CreateTable
CREATE TABLE "TimerCategory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimerCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySessionCategory" (
    "id" UUID NOT NULL,
    "studySessionId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudySessionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimerCategory_userId_idx" ON "TimerCategory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TimerCategory_userId_name_key" ON "TimerCategory"("userId", "name");

-- CreateIndex
CREATE INDEX "StudySessionCategory_studySessionId_idx" ON "StudySessionCategory"("studySessionId");

-- CreateIndex
CREATE INDEX "StudySessionCategory_categoryId_idx" ON "StudySessionCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "StudySessionCategory_studySessionId_categoryId_key" ON "StudySessionCategory"("studySessionId", "categoryId");

-- AddForeignKey
ALTER TABLE "TimerCategory" ADD CONSTRAINT "TimerCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionCategory" ADD CONSTRAINT "StudySessionCategory_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionCategory" ADD CONSTRAINT "StudySessionCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TimerCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
