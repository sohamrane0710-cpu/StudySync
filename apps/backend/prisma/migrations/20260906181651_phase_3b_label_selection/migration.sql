/*
  Warnings:

  - You are about to drop the `StudySessionGroupOverride` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "StudySessionGroupOverride" DROP CONSTRAINT "StudySessionGroupOverride_groupId_fkey";

-- DropForeignKey
ALTER TABLE "StudySessionGroupOverride" DROP CONSTRAINT "StudySessionGroupOverride_studySessionId_fkey";

-- DropTable
DROP TABLE "StudySessionGroupOverride";

-- CreateTable
CREATE TABLE "StudySessionLabelGroupSelection" (
    "id" UUID NOT NULL,
    "studySessionId" UUID NOT NULL,
    "labelId" UUID NOT NULL,
    "groupLabelId" UUID NOT NULL,
    "isIncluded" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudySessionLabelGroupSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudySessionLabelGroupSelection_studySessionId_idx" ON "StudySessionLabelGroupSelection"("studySessionId");

-- CreateIndex
CREATE INDEX "StudySessionLabelGroupSelection_labelId_idx" ON "StudySessionLabelGroupSelection"("labelId");

-- CreateIndex
CREATE INDEX "StudySessionLabelGroupSelection_groupLabelId_idx" ON "StudySessionLabelGroupSelection"("groupLabelId");

-- CreateIndex
CREATE UNIQUE INDEX "StudySessionLabelGroupSelection_studySessionId_labelId_grou_key" ON "StudySessionLabelGroupSelection"("studySessionId", "labelId", "groupLabelId");

-- AddForeignKey
ALTER TABLE "StudySessionLabelGroupSelection" ADD CONSTRAINT "StudySessionLabelGroupSelection_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionLabelGroupSelection" ADD CONSTRAINT "StudySessionLabelGroupSelection_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionLabelGroupSelection" ADD CONSTRAINT "StudySessionLabelGroupSelection_groupLabelId_fkey" FOREIGN KEY ("groupLabelId") REFERENCES "GroupLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
