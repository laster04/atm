-- Volleyball tournaments record their set scores, as league games do.
ALTER TABLE "tournament_games" ADD COLUMN "period_scores" JSONB;
