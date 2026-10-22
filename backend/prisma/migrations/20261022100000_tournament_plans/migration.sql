-- Celek B: tournament plans, the yearly Organizer plan and payments.
-- Adding "plan" with a constant default is a catalogue-only change in
-- PostgreSQL 11+, so existing tournaments become FREE without a table rewrite.

-- CreateEnum
CREATE TYPE "TournamentPlan" AS ENUM ('FREE', 'TOURNAMENT', 'TOURNAMENT_PLUS');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "plan" "TournamentPlan" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "organizer_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizer_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "variable_symbol" SERIAL NOT NULL,
    "product_code" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "payer_id" TEXT,
    "tournament_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizer_plans_payment_id_key" ON "organizer_plans"("payment_id");

-- CreateIndex
CREATE INDEX "organizer_plans_user_id_valid_until_idx" ON "organizer_plans"("user_id", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "payments_variable_symbol_key" ON "payments"("variable_symbol");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_payer_id_idx" ON "payments"("payer_id");

-- CreateIndex
CREATE INDEX "payments_tournament_id_idx" ON "payments"("tournament_id");

-- AddForeignKey
ALTER TABLE "organizer_plans" ADD CONSTRAINT "organizer_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_plans" ADD CONSTRAINT "organizer_plans_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Variable symbols are ten digits, starting with the year the plans launched.
ALTER SEQUENCE "payments_variable_symbol_seq" RESTART WITH 2026000001;
