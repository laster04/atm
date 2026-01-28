/*
  Warnings:

  - You are about to drop the column `manager_id` on the `seasons` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "seasons" DROP CONSTRAINT "Season_managerId_fkey";

-- AlterTable
ALTER TABLE "game_statistics" RENAME CONSTRAINT "GameStatistic_pkey" TO "game_statistics_pkey";

-- AlterTable
ALTER TABLE "games" RENAME CONSTRAINT "Game_pkey" TO "games_pkey";

-- AlterTable
ALTER TABLE "leagues" RENAME CONSTRAINT "League_pkey" TO "leagues_pkey";

-- AlterTable
ALTER TABLE "players" RENAME CONSTRAINT "Player_pkey" TO "players_pkey";

-- AlterTable
ALTER TABLE "seasons" RENAME CONSTRAINT "Season_pkey" TO "seasons_pkey";
ALTER TABLE "seasons" DROP COLUMN "manager_id";

-- AlterTable
ALTER TABLE "teams" RENAME CONSTRAINT "Team_pkey" TO "teams_pkey";

-- AlterTable
ALTER TABLE "users" RENAME CONSTRAINT "User_pkey" TO "users_pkey";

-- RenameForeignKey
ALTER TABLE "game_statistics" RENAME CONSTRAINT "GameStatistic_gameId_fkey" TO "game_statistics_game_id_fkey";

-- RenameForeignKey
ALTER TABLE "game_statistics" RENAME CONSTRAINT "GameStatistic_playerId_fkey" TO "game_statistics_player_id_fkey";

-- RenameForeignKey
ALTER TABLE "games" RENAME CONSTRAINT "Game_awayTeamId_fkey" TO "games_away_team_id_fkey";

-- RenameForeignKey
ALTER TABLE "games" RENAME CONSTRAINT "Game_homeTeamId_fkey" TO "games_home_team_id_fkey";

-- RenameForeignKey
ALTER TABLE "games" RENAME CONSTRAINT "Game_seasonId_fkey" TO "games_season_id_fkey";

-- RenameForeignKey
ALTER TABLE "leagues" RENAME CONSTRAINT "League_managerId_fkey" TO "leagues_manager_id_fkey";

-- RenameForeignKey
ALTER TABLE "players" RENAME CONSTRAINT "Player_teamId_fkey" TO "players_team_id_fkey";

-- RenameForeignKey
ALTER TABLE "seasons" RENAME CONSTRAINT "Season_leagueId_fkey" TO "seasons_league_id_fkey";

-- RenameForeignKey
ALTER TABLE "teams" RENAME CONSTRAINT "Team_managerId_fkey" TO "teams_manager_id_fkey";

-- RenameForeignKey
ALTER TABLE "teams" RENAME CONSTRAINT "Team_seasonId_fkey" TO "teams_season_id_fkey";

-- RenameIndex
ALTER INDEX "GameStatistic_playerId_gameId_key" RENAME TO "game_statistics_player_id_game_id_key";

-- RenameIndex
ALTER INDEX "Team_name_seasonId_key" RENAME TO "teams_name_season_id_key";

-- RenameIndex
ALTER INDEX "User_activationToken_key" RENAME TO "users_activation_token_key";

-- RenameIndex
ALTER INDEX "User_email_key" RENAME TO "users_email_key";

-- RenameIndex
ALTER INDEX "User_passwordResetToken_key" RENAME TO "users_password_reset_token_key";
