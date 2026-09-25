-- Results emails are now sent for hand-picked games rather than whole rounds,
-- so each game remembers the email it went out in. A digest without a round is
-- one of those; Postgres lets any number of them sit under the unique index.

ALTER TABLE "season_digests" ALTER COLUMN "round" DROP NOT NULL;

ALTER TABLE "games" ADD COLUMN "digest_id" TEXT;

ALTER TABLE "games" ADD CONSTRAINT "games_digest_id_fkey"
  FOREIGN KEY ("digest_id") REFERENCES "season_digests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "games_season_id_digest_id_idx" ON "games"("season_id", "digest_id");

-- Games of a round that was already summarised have been mailed; without this
-- they would all be offered again as unsent.
UPDATE "games" g
SET "digest_id" = d."id"
FROM "season_digests" d
WHERE d."season_id" = g."season_id"
  AND d."round" = g."round"
  AND g."status" = 'COMPLETED';
