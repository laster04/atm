-- An archived volleyball table keeps its split of wins and losses (3:2 / 2:3)
-- and its balls. Seasons archived before stay at zero, as nothing recorded them.
ALTER TABLE "season_archive_standings"
  ADD COLUMN "ot_wins" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ot_losses" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "part_points_for" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "part_points_against" INTEGER NOT NULL DEFAULT 0;
