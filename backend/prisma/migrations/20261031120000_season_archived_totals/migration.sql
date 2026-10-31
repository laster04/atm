-- Archiving deletes a season's games; keep how many were played and the goals in them.
ALTER TABLE "seasons" ADD COLUMN "archived_games" INTEGER;
ALTER TABLE "seasons" ADD COLUMN "archived_goals" INTEGER;

-- Seasons archived before this only have their table left. Every game sits in
-- two of its rows; play-off games were never in it and cannot be recovered.
UPDATE "seasons" s
SET "archived_games" = t.games, "archived_goals" = t.goals
FROM (
  SELECT "season_id", SUM("played") / 2 AS games, SUM("goals_for") AS goals
  FROM "season_archive_standings"
  GROUP BY "season_id"
) t
WHERE s."id" = t."season_id" AND s."archived_at" IS NOT NULL;

UPDATE "seasons"
SET "archived_games" = 0, "archived_goals" = 0
WHERE "archived_at" IS NOT NULL AND "archived_games" IS NULL;
