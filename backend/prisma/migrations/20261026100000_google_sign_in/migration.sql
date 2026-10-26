-- Sign-in with Google: the Google account an ATM account is linked to.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "google_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
