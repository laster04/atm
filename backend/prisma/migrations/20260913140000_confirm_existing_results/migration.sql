-- Standings now count confirmed results only.
--
-- Confirmation was introduced after these seasons were played, so every result
-- already in the database is unconfirmed. Leaving them that way would empty
-- every table in the product the moment this ships. They were entered as final
-- and have been shown as final ever since, so they are confirmed here.
--
-- confirmed_by_id stays null: nobody actually confirmed them, and inventing an
-- actor would put a name against a decision that person never made.
UPDATE "games"
SET "confirmed_at" = COALESCE("updated_at", CURRENT_TIMESTAMP)
WHERE "status" = 'COMPLETED'
  AND "confirmed_at" IS NULL;

-- The trail says who did what, and this was done by a migration rather than by
-- a person. One row per game, so a manager looking at a result's history sees
-- why it was already closed when they first opened it.
INSERT INTO "audit_log" ("id", "entity_type", "entity_id", "action", "reason", "created_at")
SELECT
  gen_random_uuid()::text,
  'Game',
  "id",
  'CONFIRM',
  'Confirmed automatically: played before results had to be confirmed',
  COALESCE("updated_at", CURRENT_TIMESTAMP)
FROM "games"
WHERE "status" = 'COMPLETED'
  AND "confirmed_by_id" IS NULL;
