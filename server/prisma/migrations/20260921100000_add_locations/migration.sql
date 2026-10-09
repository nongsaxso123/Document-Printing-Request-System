-- Admin-editable, bilingual drop-off / pickup places (replaces the three
-- Thai-only free-text columns on system_settings).
CREATE TABLE "locations" (
    "id" SERIAL NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL DEFAULT '',
    "detail_th" TEXT,
    "detail_en" TEXT,
    "hours_th" TEXT,
    "hours_en" TEXT,
    "phone" TEXT,
    "map_url" TEXT,
    "accepts_dropoff" BOOLEAN NOT NULL DEFAULT true,
    "accepts_pickup" BOOLEAN NOT NULL DEFAULT true,
    "is_default_dropoff" BOOLEAN NOT NULL DEFAULT false,
    "is_default_pickup" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_admin_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "requests" ADD COLUMN "dropoff_location_id" INTEGER;
ALTER TABLE "requests" ADD COLUMN "dropoff_location_snapshot" JSONB;
ALTER TABLE "requests" ADD CONSTRAINT "requests_dropoff_location_id_fkey"
    FOREIGN KEY ("dropoff_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Carry over whatever the admin had configured. The old fields held one
-- Thai string each, sometimes written "ชื่อไทย (English name)" — split that
-- convention into the two language columns when it matches, otherwise the
-- whole string goes into the Thai name and the English one is left blank
-- for the admin to fill in (display falls back to Thai meanwhile).
-- The phone number applied to the whole office, so it goes on every row.

-- Drop-off place. It also serves as the pickup place unless a different
-- pickup location was configured.
INSERT INTO "locations" ("name_th", "name_en", "phone", "accepts_dropoff", "accepts_pickup",
                         "is_default_dropoff", "is_default_pickup", "sort_order")
SELECT
    COALESCE((regexp_match(btrim(s."document_dropoff_location"), '^(.*?)\s*\((.*)\)$'))[1], btrim(s."document_dropoff_location")),
    COALESCE((regexp_match(btrim(s."document_dropoff_location"), '^(.*?)\s*\((.*)\)$'))[2], ''),
    NULLIF(btrim(s."office_contact_phone"), ''),
    true,
    (NULLIF(btrim(s."document_pickup_location"), '') IS NULL
        OR btrim(s."document_pickup_location") = btrim(s."document_dropoff_location")),
    true,
    (NULLIF(btrim(s."document_pickup_location"), '') IS NULL
        OR btrim(s."document_pickup_location") = btrim(s."document_dropoff_location")),
    1
FROM "system_settings" s
WHERE NULLIF(btrim(s."document_dropoff_location"), '') IS NOT NULL;

-- A separate pickup place, when one was configured that differs.
INSERT INTO "locations" ("name_th", "name_en", "phone", "accepts_dropoff", "accepts_pickup",
                         "is_default_dropoff", "is_default_pickup", "sort_order")
SELECT
    COALESCE((regexp_match(btrim(s."document_pickup_location"), '^(.*?)\s*\((.*)\)$'))[1], btrim(s."document_pickup_location")),
    COALESCE((regexp_match(btrim(s."document_pickup_location"), '^(.*?)\s*\((.*)\)$'))[2], ''),
    NULLIF(btrim(s."office_contact_phone"), ''),
    false,
    true,
    false,
    true,
    2
FROM "system_settings" s
WHERE NULLIF(btrim(s."document_pickup_location"), '') IS NOT NULL
  AND (NULLIF(btrim(s."document_dropoff_location"), '') IS NULL
       OR btrim(s."document_pickup_location") <> btrim(s."document_dropoff_location"));

-- Fresh database, or settings that never had a drop-off place: seed the
-- counter the old code hardcoded as its fallback, so the request form always
-- has somewhere to send people until the admin edits it.
INSERT INTO "locations" ("name_th", "name_en", "accepts_dropoff", "accepts_pickup",
                         "is_default_dropoff", "is_default_pickup", "sort_order")
SELECT 'เคาน์เตอร์ฝ่ายทะเบียน', 'Registrar Division Counter', true,
       NOT EXISTS (SELECT 1 FROM "locations" WHERE "accepts_pickup"),
       true,
       NOT EXISTS (SELECT 1 FROM "locations" WHERE "accepts_pickup"),
       3
WHERE NOT EXISTS (SELECT 1 FROM "locations" WHERE "accepts_dropoff");

ALTER TABLE "system_settings" DROP COLUMN "office_contact_phone";
ALTER TABLE "system_settings" DROP COLUMN "document_dropoff_location";
ALTER TABLE "system_settings" DROP COLUMN "document_pickup_location";
