-- v0.7 — Copy Label (FR-18) gains a second entry mode: instead of always
-- deriving each copy's label from prefix + auto-incrementing start number,
-- the Requester can now type a free-text label per copy directly.
-- copy_label_mode records which mode was used ('auto' | 'manual'); it's
-- only meaningful when copy_label_enabled is true. copy_label_manual holds
-- the per-copy strings positionally, only populated in 'manual' mode.
ALTER TABLE "requests" ADD COLUMN "copy_label_mode" TEXT;
ALTER TABLE "requests" ADD COLUMN "copy_label_manual" TEXT[] NOT NULL DEFAULT '{}';

-- Every existing enabled Copy Label predates the "manual" mode, so
-- backfilling them as 'auto' is lossless.
UPDATE "requests" SET "copy_label_mode" = 'auto' WHERE "copy_label_enabled" = true;
