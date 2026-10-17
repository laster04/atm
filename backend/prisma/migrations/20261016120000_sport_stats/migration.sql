-- Player lines are no longer hockey-only: rename in place so no line is lost.
ALTER TABLE "hockey_game_statistics" RENAME TO "player_game_statistics";
ALTER TABLE "player_game_statistics" RENAME CONSTRAINT "hockey_game_statistics_pkey" TO "player_game_statistics_pkey";
ALTER TABLE "player_game_statistics" RENAME CONSTRAINT "hockey_game_statistics_player_id_fkey" TO "player_game_statistics_player_id_fkey";
ALTER TABLE "player_game_statistics" RENAME CONSTRAINT "hockey_game_statistics_game_id_fkey" TO "player_game_statistics_game_id_fkey";
ALTER INDEX "hockey_game_statistics_player_id_game_id_key" RENAME TO "player_game_statistics_player_id_game_id_key";

ALTER TABLE "player_game_statistics"
  ADD COLUMN "yellow_cards" INTEGER,
  ADD COLUMN "red_cards" INTEGER,
  ADD COLUMN "points" INTEGER,
  ADD COLUMN "fouls" INTEGER;

ALTER TABLE "season_archive_player_stats"
  ADD COLUMN "yellow_cards" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "red_cards" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fouls" INTEGER NOT NULL DEFAULT 0;

-- Football cards in the match report.
CREATE TYPE "CardColor" AS ENUM ('YELLOW', 'RED');
ALTER TYPE "MatchEventType" ADD VALUE 'CARD';
ALTER TABLE "match_events" ADD COLUMN "card_color" "CardColor";

-- The score of each part of a game as a list, replacing three fixed periods.
-- Existing scores are copied up to the last period that has a number, so a
-- game with only periods 1 and 2 entered keeps two entries.
ALTER TABLE "games" ADD COLUMN "period_scores" JSONB;

UPDATE "games" g SET "period_scores" = (
  SELECT jsonb_agg(jsonb_build_object('home', p.h, 'away', p.a) ORDER BY p.n)
  FROM (VALUES
    (1, g."period1_home_score", g."period1_away_score"),
    (2, g."period2_home_score", g."period2_away_score"),
    (3, g."period3_home_score", g."period3_away_score")
  ) AS p(n, h, a)
  WHERE p.n <= GREATEST(
    CASE WHEN g."period1_home_score" IS NOT NULL OR g."period1_away_score" IS NOT NULL THEN 1 ELSE 0 END,
    CASE WHEN g."period2_home_score" IS NOT NULL OR g."period2_away_score" IS NOT NULL THEN 2 ELSE 0 END,
    CASE WHEN g."period3_home_score" IS NOT NULL OR g."period3_away_score" IS NOT NULL THEN 3 ELSE 0 END
  )
)
WHERE g."period1_home_score" IS NOT NULL OR g."period1_away_score" IS NOT NULL
   OR g."period2_home_score" IS NOT NULL OR g."period2_away_score" IS NOT NULL
   OR g."period3_home_score" IS NOT NULL OR g."period3_away_score" IS NOT NULL;

ALTER TABLE "games"
  DROP COLUMN "period1_home_score",
  DROP COLUMN "period1_away_score",
  DROP COLUMN "period2_home_score",
  DROP COLUMN "period2_away_score",
  DROP COLUMN "period3_home_score",
  DROP COLUMN "period3_away_score";
