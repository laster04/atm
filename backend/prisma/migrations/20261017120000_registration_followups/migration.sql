-- AlterTable
ALTER TABLE "registration_windows" ADD COLUMN "published_at" TIMESTAMP(3),
ADD COLUMN "closed_at" TIMESTAMP(3);

-- Windows already open count as published when they were last changed.
UPDATE "registration_windows" SET "published_at" = "updated_at" WHERE "open" = true;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN "withdrawn_at" TIMESTAMP(3),
ADD COLUMN "promoted_at" TIMESTAMP(3),
ADD COLUMN "promoted_by_id" TEXT,
ADD COLUMN "promoted_out_of_order" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "status_token_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "registrations_status_token_hash_key" ON "registrations"("status_token_hash");

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_promoted_by_id_fkey" FOREIGN KEY ("promoted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
