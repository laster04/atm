-- Language of the e-mails a user gets. Existing accounts start in Czech, the
-- app's home language; it follows the language picked in the app from then on.
ALTER TABLE "users" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'cs';
