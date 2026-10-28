-- AlterTable
ALTER TABLE "tournament_games" ADD COLUMN     "kept_by_link" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tournament_scorer_links" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "label" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_scorer_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_goals" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "player_id" TEXT,
    "assist_player_id" TEXT,
    "scorer_link_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_scorer_links_token_hash_key" ON "tournament_scorer_links"("token_hash");

-- CreateIndex
CREATE INDEX "tournament_scorer_links_tournament_id_location_idx" ON "tournament_scorer_links"("tournament_id", "location");

-- CreateIndex
CREATE INDEX "tournament_goals_game_id_idx" ON "tournament_goals"("game_id");

-- AddForeignKey
ALTER TABLE "tournament_scorer_links" ADD CONSTRAINT "tournament_scorer_links_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_scorer_links" ADD CONSTRAINT "tournament_scorer_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_goals" ADD CONSTRAINT "tournament_goals_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "tournament_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_goals" ADD CONSTRAINT "tournament_goals_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_goals" ADD CONSTRAINT "tournament_goals_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "tournament_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_goals" ADD CONSTRAINT "tournament_goals_assist_player_id_fkey" FOREIGN KEY ("assist_player_id") REFERENCES "tournament_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_goals" ADD CONSTRAINT "tournament_goals_scorer_link_id_fkey" FOREIGN KEY ("scorer_link_id") REFERENCES "tournament_scorer_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

