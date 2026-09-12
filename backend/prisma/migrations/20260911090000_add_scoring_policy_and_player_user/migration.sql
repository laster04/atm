-- Scoring overrides. Null means "use the sport default" from
-- services/scoring/policy.ts; a season inherits its league, a tournament its
-- series, unless it carries its own.
ALTER TABLE "leagues" ADD COLUMN     "scoring" JSONB;
ALTER TABLE "seasons" ADD COLUMN     "scoring" JSONB;
ALTER TABLE "tournament_series" ADD COLUMN     "scoring" JSONB;
ALTER TABLE "tournaments" ADD COLUMN     "scoring" JSONB;

-- Links a roster row to the account of the person who holds it. Nullable: most
-- players never sign in, and deleting an account must not delete their history.
ALTER TABLE "players" ADD COLUMN     "user_id" TEXT;

CREATE INDEX "players_user_id_idx" ON "players"("user_id");
CREATE UNIQUE INDEX "players_team_id_user_id_key" ON "players"("team_id", "user_id");

ALTER TABLE "players" ADD CONSTRAINT "players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Freeze the behaviour that was hard-coded before this migration, so no
-- existing table changes when the shared scoring service takes over.
--
-- Leagues ran on 2 points for a win, 1 for a draw, ranked by points, goal
-- difference, then goals for.
UPDATE "seasons"
SET "scoring" = '{"winPoints":2,"drawPoints":1,"lossPoints":0,"otWinPoints":2,"otLossPoints":1,"allowDraws":true,"tiebreakers":["GOAL_DIFF","GOALS_FOR"]}'::jsonb
WHERE "scoring" IS NULL;

-- Tournaments ran on 3/1/0 with the same ranking...
UPDATE "tournaments"
SET "scoring" = '{"winPoints":3,"drawPoints":1,"lossPoints":0,"otWinPoints":3,"otLossPoints":1,"allowDraws":true,"tiebreakers":["GOAL_DIFF","GOALS_FOR"]}'::jsonb
WHERE "scoring" IS NULL
  AND "series_id" IN (SELECT "id" FROM "tournament_series" WHERE "sport_type" <> 'TENNIS');

-- ...except tennis, which was win/loss only and broke ties head-to-head.
UPDATE "tournaments"
SET "scoring" = '{"winPoints":1,"drawPoints":0,"lossPoints":0,"otWinPoints":1,"otLossPoints":0,"allowDraws":false,"tiebreakers":["HEAD_TO_HEAD"]}'::jsonb
WHERE "scoring" IS NULL
  AND "series_id" IN (SELECT "id" FROM "tournament_series" WHERE "sport_type" = 'TENNIS');
