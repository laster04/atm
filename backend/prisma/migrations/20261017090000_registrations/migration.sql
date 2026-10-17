-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'WAITLISTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "registration_windows" (
    "id" TEXT NOT NULL,
    "season_id" TEXT,
    "tournament_id" TEXT,
    "open" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TIMESTAMP(3),
    "max_teams" INTEGER,
    "rules" TEXT,
    "rules_version" INTEGER NOT NULL DEFAULT 1,
    "fee" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "window_id" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "applicant_id" TEXT,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'cs',
    "existing_team_id" TEXT,
    "team_name" TEXT NOT NULL,
    "primary_color" TEXT,
    "roster" JSONB,
    "rules_accepted_at" TIMESTAMP(3),
    "rules_version" INTEGER,
    "decided_at" TIMESTAMP(3),
    "decided_by_id" TEXT,
    "reason" TEXT,
    "team_id" TEXT,
    "tournament_team_id" TEXT,
    "client_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_windows_season_id_key" ON "registration_windows"("season_id");

-- CreateIndex
CREATE UNIQUE INDEX "registration_windows_tournament_id_key" ON "registration_windows"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_tournament_team_id_key" ON "registrations"("tournament_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_client_token_key" ON "registrations"("client_token");

-- CreateIndex
CREATE INDEX "registrations_window_id_status_idx" ON "registrations"("window_id", "status");

-- CreateIndex
CREATE INDEX "registrations_applicant_id_idx" ON "registrations"("applicant_id");

-- AddForeignKey
ALTER TABLE "registration_windows" ADD CONSTRAINT "registration_windows_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_windows" ADD CONSTRAINT "registration_windows_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_window_id_fkey" FOREIGN KEY ("window_id") REFERENCES "registration_windows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_existing_team_id_fkey" FOREIGN KEY ("existing_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_tournament_team_id_fkey" FOREIGN KEY ("tournament_team_id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A window belongs to exactly one competition.
ALTER TABLE "registration_windows" ADD CONSTRAINT "registration_windows_one_target"
  CHECK (("season_id" IS NULL) <> ("tournament_id" IS NULL));
