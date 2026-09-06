/*
  Warnings:

  - You are about to drop the column `labelId` on the `StudySession` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "StudySession" DROP CONSTRAINT "StudySession_labelId_fkey";

-- DropIndex
DROP INDEX "StudySession_labelId_idx";

-- AlterTable
ALTER TABLE "StudySession" DROP COLUMN "labelId";

-- AlterTable
ALTER TABLE "TimerSession" ADD COLUMN     "roomId" UUID,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RoomParticipation" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "timerSessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "RoomParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupLabel" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabelAssociation" (
    "id" UUID NOT NULL,
    "labelId" UUID NOT NULL,
    "groupLabelId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabelAssociation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySessionGroupContribution" (
    "id" UUID NOT NULL,
    "studySessionId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudySessionGroupContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionDimension" (
    "id" UUID NOT NULL,
    "contributionId" UUID NOT NULL,
    "groupLabelId" UUID,
    "groupLabelNameSnapshot" TEXT NOT NULL,

    CONSTRAINT "ContributionDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LabelToStudySession" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_LabelToStudySession_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "RoomParticipation_roomId_idx" ON "RoomParticipation"("roomId");

-- CreateIndex
CREATE INDEX "RoomParticipation_timerSessionId_idx" ON "RoomParticipation"("timerSessionId");

-- CreateIndex
CREATE INDEX "RoomParticipation_userId_idx" ON "RoomParticipation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupLabel_groupId_name_key" ON "GroupLabel"("groupId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LabelAssociation_labelId_groupLabelId_key" ON "LabelAssociation"("labelId", "groupLabelId");

-- CreateIndex
CREATE INDEX "StudySessionGroupContribution_groupId_idx" ON "StudySessionGroupContribution"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "StudySessionGroupContribution_studySessionId_groupId_key" ON "StudySessionGroupContribution"("studySessionId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionDimension_contributionId_groupLabelNameSnapshot_key" ON "ContributionDimension"("contributionId", "groupLabelNameSnapshot");

-- CreateIndex
CREATE INDEX "_LabelToStudySession_B_index" ON "_LabelToStudySession"("B");

-- CreateIndex
CREATE INDEX "TimerSession_roomId_idx" ON "TimerSession"("roomId");

-- AddForeignKey
ALTER TABLE "TimerSession" ADD CONSTRAINT "TimerSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomParticipation" ADD CONSTRAINT "RoomParticipation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomParticipation" ADD CONSTRAINT "RoomParticipation_timerSessionId_fkey" FOREIGN KEY ("timerSessionId") REFERENCES "TimerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomParticipation" ADD CONSTRAINT "RoomParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupLabel" ADD CONSTRAINT "GroupLabel_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelAssociation" ADD CONSTRAINT "LabelAssociation_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelAssociation" ADD CONSTRAINT "LabelAssociation_groupLabelId_fkey" FOREIGN KEY ("groupLabelId") REFERENCES "GroupLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionGroupContribution" ADD CONSTRAINT "StudySessionGroupContribution_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionGroupContribution" ADD CONSTRAINT "StudySessionGroupContribution_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionDimension" ADD CONSTRAINT "ContributionDimension_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "StudySessionGroupContribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionDimension" ADD CONSTRAINT "ContributionDimension_groupLabelId_fkey" FOREIGN KEY ("groupLabelId") REFERENCES "GroupLabel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LabelToStudySession" ADD CONSTRAINT "_LabelToStudySession_A_fkey" FOREIGN KEY ("A") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LabelToStudySession" ADD CONSTRAINT "_LabelToStudySession_B_fkey" FOREIGN KEY ("B") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
