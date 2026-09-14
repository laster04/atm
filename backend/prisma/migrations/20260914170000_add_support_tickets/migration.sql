-- The newest release note a user has seen; null until they first open /updates.
ALTER TABLE "users" ADD COLUMN "updates_seen_at" TIMESTAMP(3);

-- Messages sent through the contact form.
CREATE TYPE "SupportCategory" AS ENUM ('QUESTION', 'PROBLEM', 'COMPLAINT', 'IDEA');
CREATE TYPE "SupportTicketStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED');

CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "context" JSONB,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'NEW',
    "client_token" TEXT NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_tickets_client_token_key" ON "support_tickets"("client_token");
CREATE INDEX "support_tickets_status_created_at_idx" ON "support_tickets"("status", "created_at");

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
