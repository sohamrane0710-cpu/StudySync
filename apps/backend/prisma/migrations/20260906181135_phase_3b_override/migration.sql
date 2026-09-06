-- CreateTable
CREATE TABLE "StudySessionGroupOverride" (
    "id" UUID NOT NULL,
    "studySessionId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "isExcluded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudySessionGroupOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudySessionGroupOverride_groupId_idx" ON "StudySessionGroupOverride"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "StudySessionGroupOverride_studySessionId_groupId_key" ON "StudySessionGroupOverride"("studySessionId", "groupId");

-- AddForeignKey
ALTER TABLE "StudySessionGroupOverride" ADD CONSTRAINT "StudySessionGroupOverride_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionGroupOverride" ADD CONSTRAINT "StudySessionGroupOverride_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
