-- Admin role managed in the app (in addition to ADMIN_EMAILS in .env).
ALTER TABLE "officers" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;
-- Who granted the admin role and when (assigned_by/assigned_date stay
-- "who added this officer").
ALTER TABLE "officers" ADD COLUMN "admin_granted_by" TEXT;
ALTER TABLE "officers" ADD COLUMN "admin_granted_at" TIMESTAMP(3);
