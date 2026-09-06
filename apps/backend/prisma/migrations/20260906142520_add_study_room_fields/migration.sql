-- CreateEnum
CREATE TYPE "RoomVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RoomRole" AS ENUM ('OWNER', 'MEMBER');

-- AlterTable
ALTER TABLE "RoomMember" ADD COLUMN     "role" "RoomRole" NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "StudyRoom" ADD COLUMN     "description" TEXT,
ADD COLUMN     "visibility" "RoomVisibility" NOT NULL DEFAULT 'PUBLIC';
