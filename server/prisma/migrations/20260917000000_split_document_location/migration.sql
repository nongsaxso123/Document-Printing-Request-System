-- Split the single drop-off/pickup location field in two: the "submitted"
-- email told Requesters where to bring the original document, while the
-- "ready" email always hardcoded "เคาน์เตอร์ฝ่ายทะเบียน" for pickup instead
-- of using this admin-editable value at all. RENAME (not drop+add)
-- preserves the location text admins already configured.
ALTER TABLE "system_settings" RENAME COLUMN "document_location" TO "document_dropoff_location";
ALTER TABLE "system_settings" ADD COLUMN "document_pickup_location" TEXT;
