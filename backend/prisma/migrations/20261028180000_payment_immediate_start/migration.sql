-- The payer asked for the plan to start at once (terms of service, section 5).
ALTER TABLE "payments" ADD COLUMN "immediate_start_consent_at" TIMESTAMP(3);
