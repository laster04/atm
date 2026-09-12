-- The event log for a league game. Player statistics, the final score and the
-- period scores are derived from it, so a correction is made once.
--
-- Nothing is backfilled. Games recorded before this migration have aggregate
-- statistics but no timeline, and inventing events to match those totals would
-- fabricate a match that never happened. Such games keep events_authoritative
-- false and their hand-entered figures; a game flips to derived the first time a
-- real event is recorded against it.

-- CreateEnum
CREATE TYPE "MatchEventType" AS ENUM ('GOAL', 'PENALTY', 'GOALIE_CHANGE', 'TIMEOUT', 'PERIOD_START', 'PERIOD_END', 'SHOOTOUT_ATTEMPT');

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "events_authoritative" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "match_events" (
    "id" TEXT NOT NULL,
    "type" "MatchEventType" NOT NULL,
    "period" INTEGER NOT NULL DEFAULT 1,
    "minute" INTEGER,
    "second" INTEGER,
    "game_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "player_id" TEXT,
    "assist_player_id" TEXT,
    "secondary_assist_player_id" TEXT,
    "penalty_minutes" INTEGER,
    "penalty_type" TEXT,
    "note" TEXT,
    "recorded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_events_game_id_idx" ON "match_events"("game_id");

-- CreateIndex
CREATE INDEX "match_events_player_id_idx" ON "match_events"("player_id");

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_assist_player_id_fkey" FOREIGN KEY ("assist_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_secondary_assist_player_id_fkey" FOREIGN KEY ("secondary_assist_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

