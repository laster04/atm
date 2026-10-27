-- Both teams report the final score of a league game; two matching reports
-- settle the game when the season allows it.

-- AlterTable
ALTER TABLE "seasons" ADD COLUMN "auto_confirm_agreed" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "game_result_claims" (
    "id" TEXT NOT NULL,
    "home_score" INTEGER NOT NULL,
    "away_score" INTEGER NOT NULL,
    "game_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "submitted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_result_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_result_claims_game_id_team_id_key" ON "game_result_claims"("game_id", "team_id");

-- AddForeignKey
ALTER TABLE "game_result_claims" ADD CONSTRAINT "game_result_claims_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_result_claims" ADD CONSTRAINT "game_result_claims_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_result_claims" ADD CONSTRAINT "game_result_claims_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
