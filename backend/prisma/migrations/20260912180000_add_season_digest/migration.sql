-- Round summary emails: the opt-out, and a record of what has already gone out
-- so the same round is not mailed twice by accident.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_digest" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "season_digests" (
    "id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "season_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "sent_by_id" TEXT,

    CONSTRAINT "season_digests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "season_digests_season_id_round_key" ON "season_digests"("season_id", "round");

-- AddForeignKey
ALTER TABLE "season_digests" ADD CONSTRAINT "season_digests_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_digests" ADD CONSTRAINT "season_digests_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

