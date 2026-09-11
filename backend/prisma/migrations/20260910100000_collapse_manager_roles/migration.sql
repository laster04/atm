-- Collapse the Role enum to ADMIN | USER.
--
-- SEASON_MANAGER / TEAM_MANAGER / TOURNAMENT_MANAGER duplicated information that
-- already lives in the manager relations (leagues.manager_id, teams.manager_id,
-- tournament_series.manager_id), and being single-valued they made it impossible
-- for one account to both run a league and manage a team. Authorization now reads
-- the relations; the enum only marks global administrators.

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'USER');

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (CASE WHEN "role"::text = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END)::"Role_new";

DROP TYPE "Role";

ALTER TYPE "Role_new" RENAME TO "Role";

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
