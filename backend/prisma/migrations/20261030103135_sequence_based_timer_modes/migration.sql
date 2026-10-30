-- CreateEnum
CREATE TYPE "TimerStepType" AS ENUM ('FOCUS', 'REST');

-- CreateEnum
CREATE TYPE "TimerDirection" AS ENUM ('COUNTDOWN', 'COUNT_UP');

-- AlterTable
ALTER TABLE "study_sessions" ADD COLUMN     "step_index" INTEGER,
ADD COLUMN     "step_name" VARCHAR(60);

-- AlterTable
ALTER TABLE "timer_modes" ADD COLUMN     "default_direction" "TimerDirection" NOT NULL DEFAULT 'COUNTDOWN',
ADD COLUMN     "is_looping" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "focus_duration" SET DEFAULT 1500,
ALTER COLUMN "short_break_duration" SET DEFAULT 300,
ALTER COLUMN "long_break_duration" SET DEFAULT 900;

-- AlterTable
ALTER TABLE "timer_sessions" ADD COLUMN     "direction" "TimerDirection" NOT NULL DEFAULT 'COUNTDOWN',
ADD COLUMN     "elapsed_seconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "step_id" UUID,
ADD COLUMN     "step_index" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "step_name" VARCHAR(60),
ADD COLUMN     "step_type" "TimerStepType",
ADD COLUMN     "total_steps" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "auto_start_next_session" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "timer_mode_steps" (
    "id" UUID NOT NULL,
    "timer_mode_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "type" "TimerStepType" NOT NULL DEFAULT 'FOCUS',
    "duration" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "timer_mode_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timer_mode_steps_timer_mode_id_order_idx" ON "timer_mode_steps"("timer_mode_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "timer_mode_steps_timer_mode_id_order_key" ON "timer_mode_steps"("timer_mode_id", "order");

-- AddForeignKey
ALTER TABLE "timer_mode_steps" ADD CONSTRAINT "timer_mode_steps_timer_mode_id_fkey" FOREIGN KEY ("timer_mode_id") REFERENCES "timer_modes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "timer_mode_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data Migration: Convert existing TimerMode records into ordered TimerModeStep sequences
DO $$
DECLARE
    m RECORD;
    k INT;
    interval_val INT;
BEGIN
    FOR m IN SELECT id, focus_duration, short_break_duration, long_break_duration, long_break_interval FROM "timer_modes" LOOP
        -- Only generate steps if this mode has no steps yet (idempotency guard)
        IF NOT EXISTS (SELECT 1 FROM "timer_mode_steps" WHERE "timer_mode_id" = m.id) THEN
            interval_val := GREATEST(1, COALESCE(m.long_break_interval, 4));

            FOR k IN 0..(interval_val - 1) LOOP
                -- Focus step (Order 2*k)
                INSERT INTO "timer_mode_steps" ("id", "timer_mode_id", "name", "type", "duration", "order", "created_at", "updated_at")
                VALUES (
                    gen_random_uuid(),
                    m.id,
                    'Focus ' || (k + 1),
                    'FOCUS'::"TimerStepType",
                    COALESCE(m.focus_duration, 1500),
                    2 * k,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                );

                -- Break step (Order 2*k + 1)
                IF k < (interval_val - 1) THEN
                    -- Short Rest
                    INSERT INTO "timer_mode_steps" ("id", "timer_mode_id", "name", "type", "duration", "order", "created_at", "updated_at")
                    VALUES (
                        gen_random_uuid(),
                        m.id,
                        'Short Rest ' || (k + 1),
                        'REST'::"TimerStepType",
                        COALESCE(m.short_break_duration, 300),
                        2 * k + 1,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    );
                ELSE
                    -- Long Rest (final step of the sequence)
                    INSERT INTO "timer_mode_steps" ("id", "timer_mode_id", "name", "type", "duration", "order", "created_at", "updated_at")
                    VALUES (
                        gen_random_uuid(),
                        m.id,
                        'Long Rest',
                        'REST'::"TimerStepType",
                        COALESCE(m.long_break_duration, 900),
                        2 * k + 1,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    );
                END IF;
            END LOOP;
        END IF;
    END LOOP;
END $$;

-- Backfill existing timer_sessions with initial step references
UPDATE "timer_sessions" ts
SET
    "step_id" = s.id,
    "step_index" = 0,
    "step_name" = s.name,
    "step_type" = s.type,
    "total_steps" = (
        SELECT COUNT(*)::INT
        FROM "timer_mode_steps" tms
        WHERE tms.timer_mode_id = ts.timer_mode_id
    ),
    "direction" = 'COUNTDOWN'::"TimerDirection"
FROM "timer_mode_steps" s
WHERE ts.timer_mode_id IS NOT NULL
  AND s.timer_mode_id = ts.timer_mode_id
  AND s.order = 0
  AND ts.step_id IS NULL;

