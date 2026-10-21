-- CreateEnum
CREATE TYPE "VatCheckStatus" AS ENUM ('VALID', 'INVALID', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "can_manage_pricing" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_cs" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "price_czk" INTEGER NOT NULL,
    "price_eur" INTEGER NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_rates" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "rate_bp" INTEGER NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vat_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_limits" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "vat_checks" (
    "id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "vat_number" TEXT NOT NULL,
    "status" "VatCheckStatus" NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "request_identifier" TEXT,
    "request_date" TIMESTAMP(3),
    "response" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "next_retry_at" TIMESTAMP(3),
    "checked_at" TIMESTAMP(3) NOT NULL,
    "requested_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vat_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "product_prices_product_id_valid_from_idx" ON "product_prices"("product_id", "valid_from");

-- CreateIndex
CREATE INDEX "vat_rates_country_valid_from_idx" ON "vat_rates"("country", "valid_from");

-- CreateIndex
CREATE INDEX "plan_limits_plan_key_valid_from_idx" ON "plan_limits"("plan", "key", "valid_from");

-- CreateIndex
CREATE INDEX "vat_checks_country_code_vat_number_checked_at_idx" ON "vat_checks"("country_code", "vat_number", "checked_at");

-- CreateIndex
CREATE INDEX "vat_checks_status_next_retry_at_idx" ON "vat_checks"("status", "next_retry_at");

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_rates" ADD CONSTRAINT "vat_rates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_limits" ADD CONSTRAINT "plan_limits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_checks" ADD CONSTRAINT "vat_checks_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Default values from canvas page 13, in force from 21 October 2026, 00:00 Prague.
-- Later changes are new rows made in the administration, never edits of these.
INSERT INTO "products" ("id", "code", "name_cs", "name_en", "sort_order") VALUES
  (gen_random_uuid(), 'TOURNAMENT', 'Turnaj', 'Tournament', 1),
  (gen_random_uuid(), 'TOURNAMENT_PLUS', 'Turnaj Plus', 'Tournament Plus', 2),
  (gen_random_uuid(), 'ORGANIZER_YEAR', 'Organizátor (rok)', 'Organiser (year)', 3);

INSERT INTO "product_prices" ("id", "product_id", "price_czk", "price_eur", "valid_from")
SELECT gen_random_uuid(), p."id", v.czk, v.eur, TIMESTAMP '2026-10-20 22:00:00'
FROM "products" p
JOIN (VALUES ('TOURNAMENT', 69000, 2900), ('TOURNAMENT_PLUS', 149000, 5900), ('ORGANIZER_YEAR', 499000, 19900)) AS v(code, czk, eur)
  ON v.code = p."code";

-- Only the Czech rate is set; other EU rates are added in the administration
-- once the accountant has confirmed them (they matter only with OSS on).
INSERT INTO "vat_rates" ("id", "country", "rate_bp", "valid_from")
VALUES (gen_random_uuid(), 'CZ', 2100, TIMESTAMP '2026-10-20 22:00:00');

-- Plan limits from canvas page 16. NULL = unlimited, 0 = not included.
INSERT INTO "plan_limits" ("id", "plan", "key", "value", "valid_from")
SELECT gen_random_uuid(), v.plan, v.key, v.value, TIMESTAMP '2026-10-20 22:00:00'
FROM (VALUES
  ('FREE', 'TEAMS_PER_TOURNAMENT', 6), ('TOURNAMENT', 'TEAMS_PER_TOURNAMENT', 32),
  ('TOURNAMENT_PLUS', 'TEAMS_PER_TOURNAMENT', NULL), ('ORGANIZER', 'TEAMS_PER_TOURNAMENT', NULL),
  ('FREE', 'SPONSOR_LOGOS', 0), ('TOURNAMENT', 'SPONSOR_LOGOS', 0),
  ('TOURNAMENT_PLUS', 'SPONSOR_LOGOS', 10), ('ORGANIZER', 'SPONSOR_LOGOS', 10),
  ('FREE', 'DOCUMENTS', 0), ('TOURNAMENT', 'DOCUMENTS', 0),
  ('TOURNAMENT_PLUS', 'DOCUMENTS', 5), ('ORGANIZER', 'DOCUMENTS', 5),
  ('FREE', 'DOCUMENT_MAX_MB', 0), ('TOURNAMENT', 'DOCUMENT_MAX_MB', 0),
  ('TOURNAMENT_PLUS', 'DOCUMENT_MAX_MB', 10), ('ORGANIZER', 'DOCUMENT_MAX_MB', 10),
  ('FREE', 'LOGO_MAX_MB', 1), ('TOURNAMENT', 'LOGO_MAX_MB', 1),
  ('TOURNAMENT_PLUS', 'LOGO_MAX_MB', 1), ('ORGANIZER', 'LOGO_MAX_MB', 1)
) AS v(plan, key, value);

INSERT INTO "app_settings" ("key", "value", "updated_at") VALUES ('oss', '{"enabled": false}', CURRENT_TIMESTAMP);

-- Only this account may change pricing (decided 21 October 2026).
UPDATE "users" SET "can_manage_pricing" = true WHERE "email" = 'admin@atm.cz';
