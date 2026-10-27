-- AlterTable
ALTER TABLE "match_events" ADD COLUMN     "scorer_link_id" TEXT;

-- CreateTable
CREATE TABLE "scorer_links" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "label" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scorer_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scorer_links_token_hash_key" ON "scorer_links"("token_hash");

-- CreateIndex
CREATE INDEX "scorer_links_game_id_idx" ON "scorer_links"("game_id");

-- AddForeignKey
ALTER TABLE "scorer_links" ADD CONSTRAINT "scorer_links_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorer_links" ADD CONSTRAINT "scorer_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_scorer_link_id_fkey" FOREIGN KEY ("scorer_link_id") REFERENCES "scorer_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

