-- League plan: the yearly plan per league, each season's cover, the paywall switch.
-- Existing seasons become FREE (column default); existing leagues are free until
-- the end of 31 Aug 2027 (Prague), decided 16 Nov 2026.

-- CreateEnum
CREATE TYPE "SeasonPlan" AS ENUM ('FREE', 'TRIAL', 'LEAGUE', 'UNPAID');

-- CreateEnum
CREATE TYPE "LeaguePlanBand" AS ENUM ('SMALL', 'LARGE');

-- AlterTable
ALTER TABLE "leagues" ADD COLUMN     "free_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "league_id" TEXT;

-- AlterTable
ALTER TABLE "seasons" ADD COLUMN     "plan" "SeasonPlan" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "league_trial_used_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "league_plans" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "band" "LeaguePlanBand" NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "payment_id" TEXT,
    "granted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "league_plans_payment_id_key" ON "league_plans"("payment_id");

-- CreateIndex
CREATE INDEX "league_plans_league_id_valid_until_idx" ON "league_plans"("league_id", "valid_until");

-- CreateIndex
CREATE INDEX "payments_league_id_idx" ON "payments"("league_id");

-- AddForeignKey
ALTER TABLE "league_plans" ADD CONSTRAINT "league_plans_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_plans" ADD CONSTRAINT "league_plans_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Leagues already in ATM need no plan for seasons created until 31 Aug 2027.
UPDATE "leagues" SET "free_until" = TIMESTAMP '2027-08-31 22:00:00';

-- Their managers had their free start already: no extra trial for a new league.
UPDATE "users" SET "league_trial_used_at" = CURRENT_TIMESTAMP
WHERE "id" IN (SELECT DISTINCT "manager_id" FROM "leagues" WHERE "manager_id" IS NOT NULL);

-- Placeholder prices until the organiser interviews; an admin changes them.
INSERT INTO "products" ("id", "code", "name_cs", "name_en", "sort_order") VALUES
  (gen_random_uuid(), 'LEAGUE_SMALL_YEAR', 'Liga do 12 týmů (rok)', 'League up to 12 teams (year)', 4),
  (gen_random_uuid(), 'LEAGUE_LARGE_YEAR', 'Liga nad 12 týmů (rok)', 'League over 12 teams (year)', 5);

INSERT INTO "product_prices" ("id", "product_id", "price_czk", "price_eur", "valid_from")
SELECT gen_random_uuid(), p."id", v.czk, v.eur, TIMESTAMP '2026-11-15 23:00:00'
FROM "products" p
JOIN (VALUES ('LEAGUE_SMALL_YEAR', 149000, 5900), ('LEAGUE_LARGE_YEAR', 249000, 9900)) AS v(code, czk, eur)
  ON v.code = p."code";

-- NULL = unlimited.
INSERT INTO "plan_limits" ("id", "plan", "key", "value", "valid_from")
SELECT gen_random_uuid(), v.plan, 'TEAMS_PER_SEASON', v.value, TIMESTAMP '2026-11-15 23:00:00'
FROM (VALUES ('LEAGUE_SMALL', 12), ('LEAGUE_LARGE', NULL::INTEGER)) AS v(plan, value);

-- The paywall stays off until an admin turns it on with real prices.
INSERT INTO "app_settings" ("key", "value", "updated_at") VALUES ('league_plans', '{"enabled": false}', CURRENT_TIMESTAMP);
