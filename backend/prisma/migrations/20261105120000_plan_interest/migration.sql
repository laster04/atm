-- CreateTable
CREATE TABLE "plan_interests" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "email" TEXT,
    "league_name" TEXT,
    "team_count" INTEGER,
    "client_token" TEXT NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_interests_client_token_key" ON "plan_interests"("client_token");

-- CreateIndex
CREATE INDEX "plan_interests_plan_created_at_idx" ON "plan_interests"("plan", "created_at");

-- AddForeignKey
ALTER TABLE "plan_interests" ADD CONSTRAINT "plan_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
