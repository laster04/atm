-- CreateEnum
CREATE TYPE "PlayoffRound" AS ENUM ('ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'BRONZE');

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "playoff_series_id" TEXT;

-- CreateTable
CREATE TABLE "playoff_series" (
    "id" TEXT NOT NULL,
    "round" "PlayoffRound" NOT NULL,
    "slot" INTEGER NOT NULL,
    "best_of" INTEGER NOT NULL,
    "home_seed" INTEGER,
    "away_seed" INTEGER,
    "home_team_id" TEXT,
    "away_team_id" TEXT,
    "winner_team_id" TEXT,
    "season_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playoff_series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "playoff_series_season_id_round_slot_key" ON "playoff_series"("season_id", "round", "slot");

-- CreateIndex
CREATE INDEX "games_playoff_series_id_idx" ON "games"("playoff_series_id");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_playoff_series_id_fkey" FOREIGN KEY ("playoff_series_id") REFERENCES "playoff_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playoff_series" ADD CONSTRAINT "playoff_series_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playoff_series" ADD CONSTRAINT "playoff_series_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playoff_series" ADD CONSTRAINT "playoff_series_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playoff_series" ADD CONSTRAINT "playoff_series_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

