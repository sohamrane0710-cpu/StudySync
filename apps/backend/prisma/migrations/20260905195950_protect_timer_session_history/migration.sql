-- DropForeignKey
ALTER TABLE "TimerSession" DROP CONSTRAINT "TimerSession_timerModeId_fkey";

-- AddForeignKey
ALTER TABLE "TimerSession" ADD CONSTRAINT "TimerSession_timerModeId_fkey" FOREIGN KEY ("timerModeId") REFERENCES "TimerMode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
