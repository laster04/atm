-- Visibility for leagues, seasons and tournament series.
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- Everything that exists today has been public since the day it was created.
-- Hiding it now would pull live leagues off the site the moment this ships.
ALTER TABLE "leagues" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "tournament_series" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';

ALTER TABLE "seasons" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';

-- A DRAFT season was left out of every list for anyone but its league's
-- manager, and could still be opened by link. That is exactly UNLISTED, so the
-- rule it replaces keeps doing what it did for the seasons it already covered.
UPDATE "seasons" SET "visibility" = 'UNLISTED' WHERE "status" = 'DRAFT';

-- From here on a new season starts unlisted and has to be published.
ALTER TABLE "seasons" ALTER COLUMN "visibility" SET DEFAULT 'UNLISTED';
