-- The "core question" idea was dropped (2026-11-13): the report's headline is
-- the average satisfaction of the chosen period instead, and every question
-- can be edited or deleted alike.
ALTER TABLE "evaluation_questions" DROP COLUMN "is_core";
ALTER TABLE "evaluations" DROP COLUMN "core_rating";

-- The starting questions were created by a migration on 2026-11-13 but were
-- answered (migrated answers) since the first evaluation. The report flags a
-- question as "added during the period" by its created_at, so date them back
-- to when they were really in use.
UPDATE "evaluation_questions" q SET "created_at" = sub.first_at
FROM (SELECT MIN("submitted_at") AS first_at FROM "evaluations") sub
WHERE q."id" BETWEEN 1 AND 6 AND sub.first_at IS NOT NULL AND q."created_at" > sub.first_at;
