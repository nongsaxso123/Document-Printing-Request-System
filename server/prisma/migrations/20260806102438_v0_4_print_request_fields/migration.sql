-- v0.4: replace printOption (single combined value) with independent Color
-- Mode / Print Side; finishing/binding become multi-select arrays (was
-- single-select, plus a separate, now-removed Folding option); add
-- Document Type, Paper Source, and the optional per-copy Copy Label
-- (FR-03, FR-17, FR-18). New columns are nullable — requests.js enforces
-- them as required for new submissions at the application layer, so this
-- migration never needs a default against existing rows.
ALTER TABLE "requests" DROP COLUMN "folding_option",
DROP COLUMN "print_option",
ADD COLUMN     "color_mode" TEXT,
ADD COLUMN     "copy_label_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "copy_label_prefix" TEXT,
ADD COLUMN     "copy_label_start" INTEGER,
ADD COLUMN     "document_type" TEXT,
ADD COLUMN     "paper_source" TEXT,
ADD COLUMN     "print_side" TEXT,
DROP COLUMN "finishing_option",
ADD COLUMN     "finishing_option" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "binding_option",
ADD COLUMN     "binding_option" TEXT[] DEFAULT ARRAY[]::TEXT[];
