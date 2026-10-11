-- CreateTable
CREATE TABLE "manager_invites" (
    "id" TEXT NOT NULL,
    "team_id" TEXT,
    "league_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'cs',
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "invited_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manager_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manager_invites_token_hash_key" ON "manager_invites"("token_hash");

-- CreateIndex
CREATE INDEX "manager_invites_team_id_idx" ON "manager_invites"("team_id");

-- CreateIndex
CREATE INDEX "manager_invites_league_id_idx" ON "manager_invites"("league_id");

-- AddForeignKey
ALTER TABLE "manager_invites" ADD CONSTRAINT "manager_invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_invites" ADD CONSTRAINT "manager_invites_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_invites" ADD CONSTRAINT "manager_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An invite names exactly one thing to manage.
ALTER TABLE "manager_invites" ADD CONSTRAINT "manager_invites_one_target" CHECK (("team_id" IS NULL) <> ("league_id" IS NULL));
