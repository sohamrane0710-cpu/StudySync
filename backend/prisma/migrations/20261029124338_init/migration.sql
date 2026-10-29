-- CreateEnum
CREATE TYPE "TimerPhase" AS ENUM ('FOCUS', 'SHORT_BREAK', 'LONG_BREAK');

-- CreateEnum
CREATE TYPE "TimerStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StudySessionStatus" AS ENUM ('COMPLETED', 'INTERRUPTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoomRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "avatar_url" TEXT,
    "bio" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "theme" VARCHAR(30) NOT NULL DEFAULT 'dark-glass',
    "timer_face" VARCHAR(30) NOT NULL DEFAULT 'ring',
    "ambient_preset" VARCHAR(50),
    "sound_volume" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_start_breaks" BOOLEAN NOT NULL DEFAULT false,
    "auto_start_pomodoros" BOOLEAN NOT NULL DEFAULT false,
    "default_timer_mode_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer_modes" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(255),
    "focus_duration" INTEGER NOT NULL,
    "short_break_duration" INTEGER NOT NULL,
    "long_break_duration" INTEGER NOT NULL,
    "long_break_interval" INTEGER NOT NULL DEFAULT 4,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "timer_modes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "timer_mode_id" UUID,
    "phase" "TimerPhase" NOT NULL DEFAULT 'FOCUS',
    "status" "TimerStatus" NOT NULL DEFAULT 'RUNNING',
    "target_duration" INTEGER NOT NULL,
    "remaining_seconds" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "expected_end_time" TIMESTAMPTZ(6),
    "paused_at" TIMESTAMPTZ(6),
    "cycle_count" INTEGER NOT NULL DEFAULT 0,
    "total_focus_seconds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "timer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(20) NOT NULL DEFAULT '#6366F1',
    "icon" VARCHAR(30),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "session_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_labels" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(20),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "session_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "timer_session_id" UUID,
    "room_study_session_id" UUID,
    "title" VARCHAR(120),
    "phase" "TimerPhase" NOT NULL DEFAULT 'FOCUS',
    "status" "StudySessionStatus" NOT NULL DEFAULT 'COMPLETED',
    "target_duration" INTEGER NOT NULL,
    "actual_duration" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_session_categories" (
    "study_session_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "study_session_categories_pkey" PRIMARY KEY ("study_session_id","category_id")
);

-- CreateTable
CREATE TABLE "study_session_labels" (
    "study_session_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,

    CONSTRAINT "study_session_labels_pkey" PRIMARY KEY ("study_session_id","label_id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "slug" VARCHAR(90) NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "max_participants" INTEGER NOT NULL DEFAULT 25,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_members" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "RoomRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_invites" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "inviter_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "max_uses" INTEGER,
    "uses_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6),
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_study_sessions" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "timer_mode_id" UUID,
    "phase" "TimerPhase" NOT NULL DEFAULT 'FOCUS',
    "status" "TimerStatus" NOT NULL DEFAULT 'RUNNING',
    "target_duration" INTEGER NOT NULL,
    "remaining_seconds" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "expected_end_time" TIMESTAMPTZ(6),
    "paused_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "room_study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_study_session_participants" (
    "id" UUID NOT NULL,
    "room_study_session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(6),
    "credited_seconds" INTEGER NOT NULL DEFAULT 0,
    "personal_study_session_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "room_study_session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "timer_sessions_user_id_status_idx" ON "timer_sessions"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "session_categories_user_id_name_key" ON "session_categories"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "session_labels_user_id_name_key" ON "session_labels"("user_id", "name");

-- CreateIndex
CREATE INDEX "study_sessions_user_id_started_at_idx" ON "study_sessions"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "study_sessions_user_id_status_idx" ON "study_sessions"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_slug_key" ON "rooms"("slug");

-- CreateIndex
CREATE INDEX "room_members_user_id_idx" ON "room_members"("user_id");

-- CreateIndex
CREATE INDEX "room_members_room_id_idx" ON "room_members"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_members_room_id_user_id_key" ON "room_members"("room_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_invites_token_hash_key" ON "room_invites"("token_hash");

-- CreateIndex
CREATE INDEX "room_invites_token_hash_idx" ON "room_invites"("token_hash");

-- CreateIndex
CREATE INDEX "messages_room_id_created_at_idx" ON "messages"("room_id", "created_at");

-- CreateIndex
CREATE INDEX "room_study_sessions_room_id_status_idx" ON "room_study_sessions"("room_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "room_study_session_participants_personal_study_session_id_key" ON "room_study_session_participants"("personal_study_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_study_session_participants_room_study_session_id_user__key" ON "room_study_session_participants"("room_study_session_id", "user_id");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_default_timer_mode_id_fkey" FOREIGN KEY ("default_timer_mode_id") REFERENCES "timer_modes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer_modes" ADD CONSTRAINT "timer_modes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_timer_mode_id_fkey" FOREIGN KEY ("timer_mode_id") REFERENCES "timer_modes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_categories" ADD CONSTRAINT "session_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_labels" ADD CONSTRAINT "session_labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_labels" ADD CONSTRAINT "session_labels_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "session_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_timer_session_id_fkey" FOREIGN KEY ("timer_session_id") REFERENCES "timer_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_room_study_session_id_fkey" FOREIGN KEY ("room_study_session_id") REFERENCES "room_study_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_categories" ADD CONSTRAINT "study_session_categories_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_categories" ADD CONSTRAINT "study_session_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "session_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_labels" ADD CONSTRAINT "study_session_labels_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_labels" ADD CONSTRAINT "study_session_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "session_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invites" ADD CONSTRAINT "room_invites_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invites" ADD CONSTRAINT "room_invites_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_study_sessions" ADD CONSTRAINT "room_study_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_study_sessions" ADD CONSTRAINT "room_study_sessions_timer_mode_id_fkey" FOREIGN KEY ("timer_mode_id") REFERENCES "timer_modes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_study_session_participants" ADD CONSTRAINT "room_study_session_participants_room_study_session_id_fkey" FOREIGN KEY ("room_study_session_id") REFERENCES "room_study_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_study_session_participants" ADD CONSTRAINT "room_study_session_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_study_session_participants" ADD CONSTRAINT "room_study_session_participants_personal_study_session_id_fkey" FOREIGN KEY ("personal_study_session_id") REFERENCES "study_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
