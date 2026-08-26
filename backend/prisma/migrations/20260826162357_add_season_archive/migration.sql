-- AlterTable
ALTER TABLE "seasons" ADD COLUMN     "archived_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "season_archive_standings" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "team_id" INTEGER,
    "team_name" TEXT NOT NULL,
    "team_logo" TEXT,
    "team_primary_color" TEXT,
    "rank" INTEGER NOT NULL,
    "played" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "goals_for" INTEGER NOT NULL,
    "goals_against" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_archive_standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_archive_player_stats" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "player_id" INTEGER,
    "player_name" TEXT NOT NULL,
    "player_number" INTEGER,
    "team_id" INTEGER,
    "team_name" TEXT NOT NULL,
    "games_played" INTEGER NOT NULL,
    "goals" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_archive_player_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "season_archive_standings_season_id_team_id_key" ON "season_archive_standings"("season_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "season_archive_player_stats_season_id_player_id_key" ON "season_archive_player_stats"("season_id", "player_id");

-- AddForeignKey
ALTER TABLE "season_archive_standings" ADD CONSTRAINT "season_archive_standings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_archive_standings" ADD CONSTRAINT "season_archive_standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_archive_player_stats" ADD CONSTRAINT "season_archive_player_stats_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_archive_player_stats" ADD CONSTRAINT "season_archive_player_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_archive_player_stats" ADD CONSTRAINT "season_archive_player_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
