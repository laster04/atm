-- Add period scores to games table for hockey
ALTER TABLE "games"
  ADD COLUMN "period1_home_score" INTEGER,
  ADD COLUMN "period1_away_score" INTEGER,
  ADD COLUMN "period2_home_score" INTEGER,
  ADD COLUMN "period2_away_score" INTEGER,
  ADD COLUMN "period3_home_score" INTEGER,
  ADD COLUMN "period3_away_score" INTEGER;
