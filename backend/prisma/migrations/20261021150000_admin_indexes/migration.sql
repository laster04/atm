-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_last_logged_in_at_idx" ON "users"("last_logged_in_at");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_created_at_idx" ON "audit_log"("entity_type", "created_at");

-- CreateIndex
CREATE INDEX "registrations_status_created_at_idx" ON "registrations"("status", "created_at");

