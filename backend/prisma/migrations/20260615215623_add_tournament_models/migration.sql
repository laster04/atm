-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'GROUP_STAGE', 'PLAYOFF', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TournamentGamePhase" AS ENUM ('GROUP', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'BRONZE', 'FINAL');

-- AlterTable
ALTER TABLE "hockey_game_statistics" RENAME CONSTRAINT "game_statistics_pkey" TO "hockey_game_statistics_pkey";

-- CreateTable
CREATE TABLE "tournament_series" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sport_type" "SportType" NOT NULL DEFAULT 'OTHER',
    "logo" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "manager_id" INTEGER,

    CONSTRAINT "tournament_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "series_id" INTEGER NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_teams" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "primary_color" TEXT,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tournament_id" INTEGER NOT NULL,

    CONSTRAINT "tournament_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_players" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER,
    "position" TEXT,
    "born_year" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "team_id" INTEGER NOT NULL,

    CONSTRAINT "tournament_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_groups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tournament_id" INTEGER NOT NULL,

    CONSTRAINT "tournament_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_group_teams" (
    "group_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "tournament_games" (
    "id" SERIAL NOT NULL,
    "phase" "TournamentGamePhase" NOT NULL,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "date" TIMESTAMP(3),
    "location" TEXT,
    "status" "GameStatus" NOT NULL DEFAULT 'SCHEDULED',
    "bracket_slot" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "group_id" INTEGER,
    "home_team_id" INTEGER,
    "away_team_id" INTEGER,

    CONSTRAINT "tournament_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_game_statistics" (
    "id" SERIAL NOT NULL,
    "goals" INTEGER,
    "assists" INTEGER,
    "game_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,

    CONSTRAINT "tournament_game_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_group_teams_group_id_team_id_key" ON "tournament_group_teams"("group_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_game_statistics_game_id_player_id_key" ON "tournament_game_statistics"("game_id", "player_id");

-- RenameForeignKey
ALTER TABLE "hockey_game_statistics" RENAME CONSTRAINT "game_statistics_game_id_fkey" TO "hockey_game_statistics_game_id_fkey";

-- RenameForeignKey
ALTER TABLE "hockey_game_statistics" RENAME CONSTRAINT "game_statistics_player_id_fkey" TO "hockey_game_statistics_player_id_fkey";

-- AddForeignKey
ALTER TABLE "tournament_series" ADD CONSTRAINT "tournament_series_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "tournament_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_groups" ADD CONSTRAINT "tournament_groups_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_group_teams" ADD CONSTRAINT "tournament_group_teams_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "tournament_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_group_teams" ADD CONSTRAINT "tournament_group_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "tournament_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_game_statistics" ADD CONSTRAINT "tournament_game_statistics_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "tournament_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_game_statistics" ADD CONSTRAINT "tournament_game_statistics_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "tournament_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "game_statistics_player_id_game_id_key" RENAME TO "hockey_game_statistics_player_id_game_id_key";
