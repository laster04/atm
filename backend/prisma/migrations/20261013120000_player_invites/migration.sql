-- AlterTable
ALTER TABLE "manager_invites" ADD COLUMN "player_id" TEXT;

-- CreateIndex
CREATE INDEX "manager_invites_player_id_idx" ON "manager_invites"("player_id");

-- AddForeignKey
ALTER TABLE "manager_invites" ADD CONSTRAINT "manager_invites_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An invite names exactly one thing: a team or league to manage, or a roster spot.
ALTER TABLE "manager_invites" DROP CONSTRAINT "manager_invites_one_target";
ALTER TABLE "manager_invites" ADD CONSTRAINT "manager_invites_one_target" CHECK (
    ("team_id" IS NOT NULL)::int + ("league_id" IS NOT NULL)::int + ("player_id" IS NOT NULL)::int = 1
);
