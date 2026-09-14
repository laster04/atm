-- Stamped on every successful login. Null for accounts that never logged in
-- since this shipped.
ALTER TABLE "users" ADD COLUMN "last_logged_in_at" TIMESTAMP(3);
