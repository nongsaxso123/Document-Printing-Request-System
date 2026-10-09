-- Split the free-text "workplace" field into the same category/unit pair
-- Request.agencyCategory/agencyUnit already uses, so the Profile page can
-- reuse the identical AGENCY_DATA dropdown UI. No production data existed
-- in the single "workplace" column yet (this session's feature), so a
-- plain drop is safe.
ALTER TABLE "profiles" DROP COLUMN "workplace";
ALTER TABLE "profiles" ADD COLUMN "workplace_category" TEXT;
ALTER TABLE "profiles" ADD COLUMN "workplace_unit" TEXT;
