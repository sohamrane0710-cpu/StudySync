-- AlterTable
ALTER TABLE "timer_sessions" ADD COLUMN     "resumed_at" TIMESTAMPTZ(6),
ADD COLUMN     "sequence_snapshot" JSONB;

-- Create partial unique index to enforce at most one active timer (RUNNING or PAUSED) per user
CREATE UNIQUE INDEX "unique_active_timer_per_user" ON "timer_sessions" ("user_id") WHERE status IN ('RUNNING', 'PAUSED');

