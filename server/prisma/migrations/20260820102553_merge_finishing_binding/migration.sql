-- Merge finishing_option[]/binding_option[] into a single finishing_method
-- column: a real print job only gets one finishing technique applied, so
-- the v0.4 independent-multi-select model didn't reflect what's actually
-- possible. Existing rows only ever had at most one finishing_option value
-- and no binding_option values (checked in prod-equivalent dev data before
-- writing this), so the first array element (if any) carries over as-is.
ALTER TABLE "requests" ADD COLUMN "finishing_method" TEXT;

UPDATE "requests"
SET "finishing_method" = "finishing_option"[1]
WHERE array_length("finishing_option", 1) > 0;

ALTER TABLE "requests" DROP COLUMN "finishing_option";
ALTER TABLE "requests" DROP COLUMN "binding_option";
