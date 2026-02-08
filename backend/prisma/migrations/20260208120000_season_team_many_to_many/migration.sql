-- CreateTable
CREATE TABLE "season_teams" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_teams_pkey" PRIMARY KEY ("id")
);

-- Migrate existing data: copy season_id from teams into junction table
INSERT INTO "season_teams" ("season_id", "team_id")
SELECT "season_id", "id" FROM "teams" WHERE "season_id" IS NOT NULL;

-- DropIndex (the old unique constraint on team name + season)
DROP INDEX IF EXISTS "teams_name_season_id_key";

-- DropForeignKey (team -> season)
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_season_id_fkey";

-- AlterTable: drop the season_id column from teams
ALTER TABLE "teams" DROP COLUMN "season_id";

-- Change Game onDelete for home/away team from CASCADE to RESTRICT
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_home_team_id_fkey";
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_away_team_id_fkey";
ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "season_teams_season_id_team_id_key" ON "season_teams"("season_id", "team_id");

-- AddForeignKey
ALTER TABLE "season_teams" ADD CONSTRAINT "season_teams_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_teams" ADD CONSTRAINT "season_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
