-- Convert every integer primary key and foreign key to a UUID (text) key.
-- Strategy: add parallel `uuid_*` columns, backfill, then swap in one transaction.
-- Dropping a column also drops the constraints and indexes built on it, so no
-- constraint names are referenced anywhere below.

-- ============================================================
-- Phase 1: new UUID primary keys, backfilled with fresh values
-- ============================================================

ALTER TABLE "users" ADD COLUMN "uuid_id" TEXT;
UPDATE "users" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "users" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "leagues" ADD COLUMN "uuid_id" TEXT;
UPDATE "leagues" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "leagues" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "seasons" ADD COLUMN "uuid_id" TEXT;
UPDATE "seasons" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "seasons" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "season_teams" ADD COLUMN "uuid_id" TEXT;
UPDATE "season_teams" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "season_teams" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "teams" ADD COLUMN "uuid_id" TEXT;
UPDATE "teams" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "teams" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "players" ADD COLUMN "uuid_id" TEXT;
UPDATE "players" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "players" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "games" ADD COLUMN "uuid_id" TEXT;
UPDATE "games" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "games" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "hockey_game_statistics" ADD COLUMN "uuid_id" TEXT;
UPDATE "hockey_game_statistics" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "hockey_game_statistics" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "season_archive_standings" ADD COLUMN "uuid_id" TEXT;
UPDATE "season_archive_standings" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "season_archive_standings" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "season_archive_player_stats" ADD COLUMN "uuid_id" TEXT;
UPDATE "season_archive_player_stats" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "season_archive_player_stats" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "tournament_series" ADD COLUMN "uuid_id" TEXT;
UPDATE "tournament_series" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "tournament_series" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "tournaments" ADD COLUMN "uuid_id" TEXT;
UPDATE "tournaments" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "tournaments" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "tournament_teams" ADD COLUMN "uuid_id" TEXT;
UPDATE "tournament_teams" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "tournament_teams" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "tournament_players" ADD COLUMN "uuid_id" TEXT;
UPDATE "tournament_players" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "tournament_players" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "tournament_groups" ADD COLUMN "uuid_id" TEXT;
UPDATE "tournament_groups" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "tournament_groups" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "tournament_games" ADD COLUMN "uuid_id" TEXT;
UPDATE "tournament_games" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "tournament_games" ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "tournament_game_statistics" ADD COLUMN "uuid_id" TEXT;
UPDATE "tournament_game_statistics" SET "uuid_id" = gen_random_uuid()::text;
ALTER TABLE "tournament_game_statistics" ALTER COLUMN "uuid_id" SET NOT NULL;

-- ============================================================
-- Phase 2: new UUID foreign keys, backfilled from the parent map
-- ============================================================

ALTER TABLE "leagues" ADD COLUMN "uuid_manager_id" TEXT;
UPDATE "leagues" AS c SET "uuid_manager_id" = p."uuid_id"
  FROM "users" AS p WHERE p."id" = c."manager_id";

ALTER TABLE "seasons" ADD COLUMN "uuid_league_id" TEXT;
UPDATE "seasons" AS c SET "uuid_league_id" = p."uuid_id"
  FROM "leagues" AS p WHERE p."id" = c."league_id";
ALTER TABLE "seasons" ALTER COLUMN "uuid_league_id" SET NOT NULL;

ALTER TABLE "season_teams" ADD COLUMN "uuid_season_id" TEXT;
UPDATE "season_teams" AS c SET "uuid_season_id" = p."uuid_id"
  FROM "seasons" AS p WHERE p."id" = c."season_id";
ALTER TABLE "season_teams" ALTER COLUMN "uuid_season_id" SET NOT NULL;

ALTER TABLE "season_teams" ADD COLUMN "uuid_team_id" TEXT;
UPDATE "season_teams" AS c SET "uuid_team_id" = p."uuid_id"
  FROM "teams" AS p WHERE p."id" = c."team_id";
ALTER TABLE "season_teams" ALTER COLUMN "uuid_team_id" SET NOT NULL;

ALTER TABLE "teams" ADD COLUMN "uuid_manager_id" TEXT;
UPDATE "teams" AS c SET "uuid_manager_id" = p."uuid_id"
  FROM "users" AS p WHERE p."id" = c."manager_id";

ALTER TABLE "players" ADD COLUMN "uuid_team_id" TEXT;
UPDATE "players" AS c SET "uuid_team_id" = p."uuid_id"
  FROM "teams" AS p WHERE p."id" = c."team_id";
ALTER TABLE "players" ALTER COLUMN "uuid_team_id" SET NOT NULL;

ALTER TABLE "games" ADD COLUMN "uuid_season_id" TEXT;
UPDATE "games" AS c SET "uuid_season_id" = p."uuid_id"
  FROM "seasons" AS p WHERE p."id" = c."season_id";
ALTER TABLE "games" ALTER COLUMN "uuid_season_id" SET NOT NULL;

ALTER TABLE "games" ADD COLUMN "uuid_home_team_id" TEXT;
UPDATE "games" AS c SET "uuid_home_team_id" = p."uuid_id"
  FROM "teams" AS p WHERE p."id" = c."home_team_id";
ALTER TABLE "games" ALTER COLUMN "uuid_home_team_id" SET NOT NULL;

ALTER TABLE "games" ADD COLUMN "uuid_away_team_id" TEXT;
UPDATE "games" AS c SET "uuid_away_team_id" = p."uuid_id"
  FROM "teams" AS p WHERE p."id" = c."away_team_id";
ALTER TABLE "games" ALTER COLUMN "uuid_away_team_id" SET NOT NULL;

ALTER TABLE "hockey_game_statistics" ADD COLUMN "uuid_player_id" TEXT;
UPDATE "hockey_game_statistics" AS c SET "uuid_player_id" = p."uuid_id"
  FROM "players" AS p WHERE p."id" = c."player_id";
ALTER TABLE "hockey_game_statistics" ALTER COLUMN "uuid_player_id" SET NOT NULL;

ALTER TABLE "hockey_game_statistics" ADD COLUMN "uuid_game_id" TEXT;
UPDATE "hockey_game_statistics" AS c SET "uuid_game_id" = p."uuid_id"
  FROM "games" AS p WHERE p."id" = c."game_id";
ALTER TABLE "hockey_game_statistics" ALTER COLUMN "uuid_game_id" SET NOT NULL;

ALTER TABLE "season_archive_standings" ADD COLUMN "uuid_season_id" TEXT;
UPDATE "season_archive_standings" AS c SET "uuid_season_id" = p."uuid_id"
  FROM "seasons" AS p WHERE p."id" = c."season_id";
ALTER TABLE "season_archive_standings" ALTER COLUMN "uuid_season_id" SET NOT NULL;

ALTER TABLE "season_archive_standings" ADD COLUMN "uuid_team_id" TEXT;
UPDATE "season_archive_standings" AS c SET "uuid_team_id" = p."uuid_id"
  FROM "teams" AS p WHERE p."id" = c."team_id";

ALTER TABLE "season_archive_player_stats" ADD COLUMN "uuid_season_id" TEXT;
UPDATE "season_archive_player_stats" AS c SET "uuid_season_id" = p."uuid_id"
  FROM "seasons" AS p WHERE p."id" = c."season_id";
ALTER TABLE "season_archive_player_stats" ALTER COLUMN "uuid_season_id" SET NOT NULL;

ALTER TABLE "season_archive_player_stats" ADD COLUMN "uuid_player_id" TEXT;
UPDATE "season_archive_player_stats" AS c SET "uuid_player_id" = p."uuid_id"
  FROM "players" AS p WHERE p."id" = c."player_id";

ALTER TABLE "season_archive_player_stats" ADD COLUMN "uuid_team_id" TEXT;
UPDATE "season_archive_player_stats" AS c SET "uuid_team_id" = p."uuid_id"
  FROM "teams" AS p WHERE p."id" = c."team_id";

ALTER TABLE "tournament_series" ADD COLUMN "uuid_manager_id" TEXT;
UPDATE "tournament_series" AS c SET "uuid_manager_id" = p."uuid_id"
  FROM "users" AS p WHERE p."id" = c."manager_id";

ALTER TABLE "tournaments" ADD COLUMN "uuid_series_id" TEXT;
UPDATE "tournaments" AS c SET "uuid_series_id" = p."uuid_id"
  FROM "tournament_series" AS p WHERE p."id" = c."series_id";
ALTER TABLE "tournaments" ALTER COLUMN "uuid_series_id" SET NOT NULL;

ALTER TABLE "tournament_teams" ADD COLUMN "uuid_tournament_id" TEXT;
UPDATE "tournament_teams" AS c SET "uuid_tournament_id" = p."uuid_id"
  FROM "tournaments" AS p WHERE p."id" = c."tournament_id";
ALTER TABLE "tournament_teams" ALTER COLUMN "uuid_tournament_id" SET NOT NULL;

ALTER TABLE "tournament_players" ADD COLUMN "uuid_team_id" TEXT;
UPDATE "tournament_players" AS c SET "uuid_team_id" = p."uuid_id"
  FROM "tournament_teams" AS p WHERE p."id" = c."team_id";
ALTER TABLE "tournament_players" ALTER COLUMN "uuid_team_id" SET NOT NULL;

ALTER TABLE "tournament_groups" ADD COLUMN "uuid_tournament_id" TEXT;
UPDATE "tournament_groups" AS c SET "uuid_tournament_id" = p."uuid_id"
  FROM "tournaments" AS p WHERE p."id" = c."tournament_id";
ALTER TABLE "tournament_groups" ALTER COLUMN "uuid_tournament_id" SET NOT NULL;

ALTER TABLE "tournament_group_teams" ADD COLUMN "uuid_group_id" TEXT;
UPDATE "tournament_group_teams" AS c SET "uuid_group_id" = p."uuid_id"
  FROM "tournament_groups" AS p WHERE p."id" = c."group_id";
ALTER TABLE "tournament_group_teams" ALTER COLUMN "uuid_group_id" SET NOT NULL;

ALTER TABLE "tournament_group_teams" ADD COLUMN "uuid_team_id" TEXT;
UPDATE "tournament_group_teams" AS c SET "uuid_team_id" = p."uuid_id"
  FROM "tournament_teams" AS p WHERE p."id" = c."team_id";
ALTER TABLE "tournament_group_teams" ALTER COLUMN "uuid_team_id" SET NOT NULL;

ALTER TABLE "tournament_games" ADD COLUMN "uuid_tournament_id" TEXT;
UPDATE "tournament_games" AS c SET "uuid_tournament_id" = p."uuid_id"
  FROM "tournaments" AS p WHERE p."id" = c."tournament_id";
ALTER TABLE "tournament_games" ALTER COLUMN "uuid_tournament_id" SET NOT NULL;

ALTER TABLE "tournament_games" ADD COLUMN "uuid_group_id" TEXT;
UPDATE "tournament_games" AS c SET "uuid_group_id" = p."uuid_id"
  FROM "tournament_groups" AS p WHERE p."id" = c."group_id";

ALTER TABLE "tournament_games" ADD COLUMN "uuid_home_team_id" TEXT;
UPDATE "tournament_games" AS c SET "uuid_home_team_id" = p."uuid_id"
  FROM "tournament_teams" AS p WHERE p."id" = c."home_team_id";

ALTER TABLE "tournament_games" ADD COLUMN "uuid_away_team_id" TEXT;
UPDATE "tournament_games" AS c SET "uuid_away_team_id" = p."uuid_id"
  FROM "tournament_teams" AS p WHERE p."id" = c."away_team_id";

ALTER TABLE "tournament_game_statistics" ADD COLUMN "uuid_game_id" TEXT;
UPDATE "tournament_game_statistics" AS c SET "uuid_game_id" = p."uuid_id"
  FROM "tournament_games" AS p WHERE p."id" = c."game_id";
ALTER TABLE "tournament_game_statistics" ALTER COLUMN "uuid_game_id" SET NOT NULL;

ALTER TABLE "tournament_game_statistics" ADD COLUMN "uuid_player_id" TEXT;
UPDATE "tournament_game_statistics" AS c SET "uuid_player_id" = p."uuid_id"
  FROM "tournament_players" AS p WHERE p."id" = c."player_id";
ALTER TABLE "tournament_game_statistics" ALTER COLUMN "uuid_player_id" SET NOT NULL;

-- ============================================================
-- Phase 3: drop the integer columns and rename the UUID ones
-- ============================================================

-- Foreign key columns go first, which removes every FK constraint and every
-- composite unique index that referenced them.
ALTER TABLE "leagues" DROP COLUMN "manager_id";
ALTER TABLE "leagues" RENAME COLUMN "uuid_manager_id" TO "manager_id";
ALTER TABLE "seasons" DROP COLUMN "league_id";
ALTER TABLE "seasons" RENAME COLUMN "uuid_league_id" TO "league_id";
ALTER TABLE "season_teams" DROP COLUMN "season_id";
ALTER TABLE "season_teams" RENAME COLUMN "uuid_season_id" TO "season_id";
ALTER TABLE "season_teams" DROP COLUMN "team_id";
ALTER TABLE "season_teams" RENAME COLUMN "uuid_team_id" TO "team_id";
ALTER TABLE "teams" DROP COLUMN "manager_id";
ALTER TABLE "teams" RENAME COLUMN "uuid_manager_id" TO "manager_id";
ALTER TABLE "players" DROP COLUMN "team_id";
ALTER TABLE "players" RENAME COLUMN "uuid_team_id" TO "team_id";
ALTER TABLE "games" DROP COLUMN "season_id";
ALTER TABLE "games" RENAME COLUMN "uuid_season_id" TO "season_id";
ALTER TABLE "games" DROP COLUMN "home_team_id";
ALTER TABLE "games" RENAME COLUMN "uuid_home_team_id" TO "home_team_id";
ALTER TABLE "games" DROP COLUMN "away_team_id";
ALTER TABLE "games" RENAME COLUMN "uuid_away_team_id" TO "away_team_id";
ALTER TABLE "hockey_game_statistics" DROP COLUMN "player_id";
ALTER TABLE "hockey_game_statistics" RENAME COLUMN "uuid_player_id" TO "player_id";
ALTER TABLE "hockey_game_statistics" DROP COLUMN "game_id";
ALTER TABLE "hockey_game_statistics" RENAME COLUMN "uuid_game_id" TO "game_id";
ALTER TABLE "season_archive_standings" DROP COLUMN "season_id";
ALTER TABLE "season_archive_standings" RENAME COLUMN "uuid_season_id" TO "season_id";
ALTER TABLE "season_archive_standings" DROP COLUMN "team_id";
ALTER TABLE "season_archive_standings" RENAME COLUMN "uuid_team_id" TO "team_id";
ALTER TABLE "season_archive_player_stats" DROP COLUMN "season_id";
ALTER TABLE "season_archive_player_stats" RENAME COLUMN "uuid_season_id" TO "season_id";
ALTER TABLE "season_archive_player_stats" DROP COLUMN "player_id";
ALTER TABLE "season_archive_player_stats" RENAME COLUMN "uuid_player_id" TO "player_id";
ALTER TABLE "season_archive_player_stats" DROP COLUMN "team_id";
ALTER TABLE "season_archive_player_stats" RENAME COLUMN "uuid_team_id" TO "team_id";
ALTER TABLE "tournament_series" DROP COLUMN "manager_id";
ALTER TABLE "tournament_series" RENAME COLUMN "uuid_manager_id" TO "manager_id";
ALTER TABLE "tournaments" DROP COLUMN "series_id";
ALTER TABLE "tournaments" RENAME COLUMN "uuid_series_id" TO "series_id";
ALTER TABLE "tournament_teams" DROP COLUMN "tournament_id";
ALTER TABLE "tournament_teams" RENAME COLUMN "uuid_tournament_id" TO "tournament_id";
ALTER TABLE "tournament_players" DROP COLUMN "team_id";
ALTER TABLE "tournament_players" RENAME COLUMN "uuid_team_id" TO "team_id";
ALTER TABLE "tournament_groups" DROP COLUMN "tournament_id";
ALTER TABLE "tournament_groups" RENAME COLUMN "uuid_tournament_id" TO "tournament_id";
ALTER TABLE "tournament_group_teams" DROP COLUMN "group_id";
ALTER TABLE "tournament_group_teams" RENAME COLUMN "uuid_group_id" TO "group_id";
ALTER TABLE "tournament_group_teams" DROP COLUMN "team_id";
ALTER TABLE "tournament_group_teams" RENAME COLUMN "uuid_team_id" TO "team_id";
ALTER TABLE "tournament_games" DROP COLUMN "tournament_id";
ALTER TABLE "tournament_games" RENAME COLUMN "uuid_tournament_id" TO "tournament_id";
ALTER TABLE "tournament_games" DROP COLUMN "group_id";
ALTER TABLE "tournament_games" RENAME COLUMN "uuid_group_id" TO "group_id";
ALTER TABLE "tournament_games" DROP COLUMN "home_team_id";
ALTER TABLE "tournament_games" RENAME COLUMN "uuid_home_team_id" TO "home_team_id";
ALTER TABLE "tournament_games" DROP COLUMN "away_team_id";
ALTER TABLE "tournament_games" RENAME COLUMN "uuid_away_team_id" TO "away_team_id";
ALTER TABLE "tournament_game_statistics" DROP COLUMN "game_id";
ALTER TABLE "tournament_game_statistics" RENAME COLUMN "uuid_game_id" TO "game_id";
ALTER TABLE "tournament_game_statistics" DROP COLUMN "player_id";
ALTER TABLE "tournament_game_statistics" RENAME COLUMN "uuid_player_id" TO "player_id";

-- With no foreign keys left pointing at them, the integer primary keys and
-- their owned sequences can go.
ALTER TABLE "users" DROP COLUMN "id";
ALTER TABLE "users" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "users" ADD PRIMARY KEY ("id");
ALTER TABLE "leagues" DROP COLUMN "id";
ALTER TABLE "leagues" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "leagues" ADD PRIMARY KEY ("id");
ALTER TABLE "seasons" DROP COLUMN "id";
ALTER TABLE "seasons" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "seasons" ADD PRIMARY KEY ("id");
ALTER TABLE "season_teams" DROP COLUMN "id";
ALTER TABLE "season_teams" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "season_teams" ADD PRIMARY KEY ("id");
ALTER TABLE "teams" DROP COLUMN "id";
ALTER TABLE "teams" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "teams" ADD PRIMARY KEY ("id");
ALTER TABLE "players" DROP COLUMN "id";
ALTER TABLE "players" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "players" ADD PRIMARY KEY ("id");
ALTER TABLE "games" DROP COLUMN "id";
ALTER TABLE "games" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "games" ADD PRIMARY KEY ("id");
ALTER TABLE "hockey_game_statistics" DROP COLUMN "id";
ALTER TABLE "hockey_game_statistics" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "hockey_game_statistics" ADD PRIMARY KEY ("id");
ALTER TABLE "season_archive_standings" DROP COLUMN "id";
ALTER TABLE "season_archive_standings" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "season_archive_standings" ADD PRIMARY KEY ("id");
ALTER TABLE "season_archive_player_stats" DROP COLUMN "id";
ALTER TABLE "season_archive_player_stats" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "season_archive_player_stats" ADD PRIMARY KEY ("id");
ALTER TABLE "tournament_series" DROP COLUMN "id";
ALTER TABLE "tournament_series" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "tournament_series" ADD PRIMARY KEY ("id");
ALTER TABLE "tournaments" DROP COLUMN "id";
ALTER TABLE "tournaments" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "tournaments" ADD PRIMARY KEY ("id");
ALTER TABLE "tournament_teams" DROP COLUMN "id";
ALTER TABLE "tournament_teams" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "tournament_teams" ADD PRIMARY KEY ("id");
ALTER TABLE "tournament_players" DROP COLUMN "id";
ALTER TABLE "tournament_players" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "tournament_players" ADD PRIMARY KEY ("id");
ALTER TABLE "tournament_groups" DROP COLUMN "id";
ALTER TABLE "tournament_groups" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "tournament_groups" ADD PRIMARY KEY ("id");
ALTER TABLE "tournament_games" DROP COLUMN "id";
ALTER TABLE "tournament_games" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "tournament_games" ADD PRIMARY KEY ("id");
ALTER TABLE "tournament_game_statistics" DROP COLUMN "id";
ALTER TABLE "tournament_game_statistics" RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "tournament_game_statistics" ADD PRIMARY KEY ("id");

-- ============================================================
-- Phase 4: restore unique constraints and foreign keys
-- ============================================================

CREATE UNIQUE INDEX "season_teams_season_id_team_id_key" ON "season_teams"("season_id", "team_id");
CREATE UNIQUE INDEX "hockey_game_statistics_player_id_game_id_key" ON "hockey_game_statistics"("player_id", "game_id");
CREATE UNIQUE INDEX "season_archive_standings_season_id_team_id_key" ON "season_archive_standings"("season_id", "team_id");
CREATE UNIQUE INDEX "season_archive_player_stats_season_id_player_id_key" ON "season_archive_player_stats"("season_id", "player_id");
CREATE UNIQUE INDEX "tournament_group_teams_group_id_team_id_key" ON "tournament_group_teams"("group_id", "team_id");
CREATE UNIQUE INDEX "tournament_game_statistics_game_id_player_id_key" ON "tournament_game_statistics"("game_id", "player_id");

ALTER TABLE "leagues" ADD CONSTRAINT "leagues_manager_id_fkey"
  FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_league_id_fkey"
  FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "season_teams" ADD CONSTRAINT "season_teams_season_id_fkey"
  FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "season_teams" ADD CONSTRAINT "season_teams_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_manager_id_fkey"
  FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "games" ADD CONSTRAINT "games_season_id_fkey"
  FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_fkey"
  FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_fkey"
  FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hockey_game_statistics" ADD CONSTRAINT "hockey_game_statistics_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_game_statistics" ADD CONSTRAINT "hockey_game_statistics_game_id_fkey"
  FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "season_archive_standings" ADD CONSTRAINT "season_archive_standings_season_id_fkey"
  FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "season_archive_standings" ADD CONSTRAINT "season_archive_standings_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "season_archive_player_stats" ADD CONSTRAINT "season_archive_player_stats_season_id_fkey"
  FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "season_archive_player_stats" ADD CONSTRAINT "season_archive_player_stats_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "season_archive_player_stats" ADD CONSTRAINT "season_archive_player_stats_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournament_series" ADD CONSTRAINT "tournament_series_manager_id_fkey"
  FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_series_id_fkey"
  FOREIGN KEY ("series_id") REFERENCES "tournament_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_fkey"
  FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_groups" ADD CONSTRAINT "tournament_groups_tournament_id_fkey"
  FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_group_teams" ADD CONSTRAINT "tournament_group_teams_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "tournament_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_group_teams" ADD CONSTRAINT "tournament_group_teams_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_tournament_id_fkey"
  FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "tournament_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_home_team_id_fkey"
  FOREIGN KEY ("home_team_id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_away_team_id_fkey"
  FOREIGN KEY ("away_team_id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournament_game_statistics" ADD CONSTRAINT "tournament_game_statistics_game_id_fkey"
  FOREIGN KEY ("game_id") REFERENCES "tournament_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_game_statistics" ADD CONSTRAINT "tournament_game_statistics_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "tournament_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
