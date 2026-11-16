-- Rename "agency" to "unit" everywhere (English wording decided 2026-11-13:
-- MFU's own English org chart calls its schools/centres/offices "units").
-- Pure renames: no data is copied or lost.

-- Tables
ALTER TABLE "agency_categories" RENAME TO "unit_types";
ALTER TABLE "agency_units" RENAME TO "units";

ALTER TABLE "unit_types" RENAME CONSTRAINT "agency_categories_pkey" TO "unit_types_pkey";
ALTER TABLE "units" RENAME CONSTRAINT "agency_units_pkey" TO "units_pkey";
ALTER TABLE "units" RENAME CONSTRAINT "agency_units_category_id_fkey" TO "units_category_id_fkey";
ALTER INDEX "agency_units_category_id_idx" RENAME TO "units_category_id_idx";
ALTER SEQUENCE "agency_categories_id_seq" RENAME TO "unit_types_id_seq";
ALTER SEQUENCE "agency_units_id_seq" RENAME TO "units_id_seq";

-- Request columns
ALTER TABLE "requests" RENAME COLUMN "agency_category" TO "unit_type";
ALTER TABLE "requests" RENAME COLUMN "agency_unit" TO "unit";
ALTER TABLE "requests" RENAME COLUMN "agency_category_id" TO "unit_type_id";
ALTER TABLE "requests" RENAME COLUMN "agency_unit_id" TO "unit_id";
ALTER TABLE "requests" RENAME CONSTRAINT "requests_agency_category_id_fkey" TO "requests_unit_type_id_fkey";
ALTER TABLE "requests" RENAME CONSTRAINT "requests_agency_unit_id_fkey" TO "requests_unit_id_fkey";

-- Existing audit rows use the old names; keep them matching the new filters/labels.
UPDATE "audit_log" SET "entity_type" = 'unit_type' WHERE "entity_type" = 'agency_category';
UPDATE "audit_log" SET "entity_type" = 'unit' WHERE "entity_type" = 'agency_unit';
UPDATE "audit_log" SET "action" = 'unit_type.' || substring("action" from 17) WHERE "action" LIKE 'agency_category.%';
UPDATE "audit_log" SET "action" = 'unit.' || substring("action" from 13) WHERE "action" LIKE 'agency_unit.%';
