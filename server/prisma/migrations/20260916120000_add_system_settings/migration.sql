-- Singleton row (id fixed at 1) for admin-toggleable system-wide switches:
-- email notifications to officers, and Requester-facing maintenance mode.
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "officer_email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenance_mode_enabled" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_message" TEXT,
    "updated_by_admin_email" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
