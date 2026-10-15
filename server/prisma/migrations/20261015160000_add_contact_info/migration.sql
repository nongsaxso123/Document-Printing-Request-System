-- Registrar Division phone / email shown on the login page, editable at /admin/settings.
ALTER TABLE "system_settings" ADD COLUMN "contact_phone" TEXT;
ALTER TABLE "system_settings" ADD COLUMN "contact_email" TEXT;
UPDATE "system_settings" SET "contact_phone" = '(+66) 0 5391 6433, (+66) 0 5391 6546, (+66) 0 5391 6547', "contact_email" = 'edu.reg@mfu.ac.th';
