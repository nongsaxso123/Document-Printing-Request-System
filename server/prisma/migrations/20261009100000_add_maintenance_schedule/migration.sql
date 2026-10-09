-- Optional closing window for maintenance mode (null start = from now, null end = until reopened by hand).
ALTER TABLE "system_settings" ADD COLUMN "maintenance_starts_at" TIMESTAMP(3);
ALTER TABLE "system_settings" ADD COLUMN "maintenance_ends_at" TIMESTAMP(3);
