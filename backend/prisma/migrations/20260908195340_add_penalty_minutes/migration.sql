-- AlterTable
ALTER TABLE "hockey_game_statistics" ADD COLUMN     "penalty_minutes" INTEGER;

-- AlterTable
ALTER TABLE "season_archive_player_stats" ADD COLUMN     "penalty_minutes" INTEGER NOT NULL DEFAULT 0;
