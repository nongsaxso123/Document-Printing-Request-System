-- Finishing/Binding goes back to multi-select: the Registrar Division
-- counter's own stakeholder confirmed several finishing techniques can
-- genuinely be combined (a human finishes jobs by hand, not one dedicated
-- machine per technique) — the v0.5 single-choice model was too strict.
-- finishing_method (single, nullable) becomes finishing_methods (array).
-- Existing data only ever had at most one value, so this is lossless.
ALTER TABLE "requests" ADD COLUMN "finishing_methods" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "requests"
SET "finishing_methods" = ARRAY["finishing_method"]
WHERE "finishing_method" IS NOT NULL;

ALTER TABLE "requests" DROP COLUMN "finishing_method";
