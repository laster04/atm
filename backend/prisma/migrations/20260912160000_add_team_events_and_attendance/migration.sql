-- The team calendar and who is coming to what.
--
-- A league fixture is mirrored into team_events rather than replaced: the
-- competition keeps owning its schedule, while a player sees one list.
-- Attendance is keyed on the roster row, not on an account, because most
-- players never sign in and a manager answers for them.

-- CreateEnum
CREATE TYPE "TeamEventType" AS ENUM ('MATCH', 'TRAINING', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ATTENDING', 'NOT_ATTENDING', 'MAYBE', 'NO_RESPONSE');

-- CreateTable
CREATE TABLE "team_events" (
    "id" TEXT NOT NULL,
    "type" "TeamEventType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "location" TEXT,
    "team_id" TEXT NOT NULL,
    "game_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'NO_RESPONSE',
    "note" TEXT,
    "event_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "responded_by_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_events_team_id_starts_at_idx" ON "team_events"("team_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "team_events_team_id_game_id_key" ON "team_events"("team_id", "game_id");

-- CreateIndex
CREATE INDEX "attendances_player_id_idx" ON "attendances"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_event_id_player_id_key" ON "attendances"("event_id", "player_id");

-- AddForeignKey
ALTER TABLE "team_events" ADD CONSTRAINT "team_events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_events" ADD CONSTRAINT "team_events_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_events" ADD CONSTRAINT "team_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "team_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

