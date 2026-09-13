-- Divisions and groups inside a season.
--
-- A league running two divisions is one season with two groups, not two seasons
-- kept in step by hand. Deleting a group returns its teams to the season rather
-- than dropping them from the competition, which is why the link nulls itself.

-- AlterTable
ALTER TABLE "season_teams" ADD COLUMN     "group_id" TEXT;

-- CreateTable
CREATE TABLE "season_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "season_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "season_groups_season_id_name_key" ON "season_groups"("season_id", "name");

-- CreateIndex
CREATE INDEX "season_teams_group_id_idx" ON "season_teams"("group_id");

-- AddForeignKey
ALTER TABLE "season_groups" ADD CONSTRAINT "season_groups_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_teams" ADD CONSTRAINT "season_teams_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "season_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

