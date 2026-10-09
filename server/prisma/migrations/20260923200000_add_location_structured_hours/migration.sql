-- Structured opening hours alongside the existing display strings, so
-- deadline/pickup-window math can read a place's real hours (see
-- src/locations.js buildHours / hourWindowOf) instead of every place
-- sharing one hardcoded window.
ALTER TABLE "locations" ADD COLUMN "hours_from_day" INTEGER;
ALTER TABLE "locations" ADD COLUMN "hours_to_day" INTEGER;
ALTER TABLE "locations" ADD COLUMN "hours_open_time" TEXT;
ALTER TABLE "locations" ADD COLUMN "hours_close_time" TEXT;

-- Backfill for existing rows whose hours were set through the admin
-- picker (so hours_en is always in a fixed "Mon-Fri 09:00-16:00" /
-- "Mon 09:00-16:00" shape) — parsed from hours_en rather than hours_th
-- because English day abbreviations are fixed ASCII, simpler to match in
-- SQL than the Thai day names. Rows that don't match this shape (hand-typed
-- legacy text, or no hours at all) are left null and fall back to the
-- site-wide default window at read time.
UPDATE "locations"
SET
  "hours_from_day" = (CASE substring(hours_en from '^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)')
    WHEN 'Mon' THEN 1 WHEN 'Tue' THEN 2 WHEN 'Wed' THEN 3 WHEN 'Thu' THEN 4
    WHEN 'Fri' THEN 5 WHEN 'Sat' THEN 6 WHEN 'Sun' THEN 7 END),
  "hours_to_day" = (CASE COALESCE(
      substring(hours_en from '^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)-(Mon|Tue|Wed|Thu|Fri|Sat|Sun)'),
      substring(hours_en from '^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)')
    )
    WHEN 'Mon' THEN 1 WHEN 'Tue' THEN 2 WHEN 'Wed' THEN 3 WHEN 'Thu' THEN 4
    WHEN 'Fri' THEN 5 WHEN 'Sat' THEN 6 WHEN 'Sun' THEN 7 END),
  "hours_open_time" = substring(hours_en from '(\d{1,2}:\d{2})-\d{1,2}:\d{2}$'),
  "hours_close_time" = substring(hours_en from '-(\d{1,2}:\d{2})$')
WHERE hours_en ~ '^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(-(Mon|Tue|Wed|Thu|Fri|Sat|Sun))? \d{1,2}:\d{2}-\d{1,2}:\d{2}$';
