-- Celek I: cookie-free view counts of the embedded widget, per competition, site and day.

-- CreateEnum
CREATE TYPE "EmbedKind" AS ENUM ('SEASON', 'TOURNAMENT');

-- CreateTable
CREATE TABLE "embed_views" (
    "id" TEXT NOT NULL,
    "kind" "EmbedKind" NOT NULL,
    "competition_id" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "embed_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "embed_views_day_idx" ON "embed_views"("day");

-- CreateIndex
CREATE UNIQUE INDEX "embed_views_kind_competition_id_site_day_key" ON "embed_views"("kind", "competition_id", "site", "day");
