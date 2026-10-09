-- Office contact phone + document drop-off/pickup location, shown to the
-- Requester right after they submit a request.
ALTER TABLE "system_settings" ADD COLUMN "office_contact_phone" TEXT;
ALTER TABLE "system_settings" ADD COLUMN "document_location" TEXT;
