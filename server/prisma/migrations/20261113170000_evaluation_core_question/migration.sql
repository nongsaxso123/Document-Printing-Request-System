-- One fixed "core" question (overall satisfaction) whose score is the
-- headline number of the evaluation report; see EvaluationQuestion.isCore.
ALTER TABLE "evaluation_questions" ADD COLUMN "is_core" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "evaluations" ADD COLUMN "core_rating" INTEGER;

-- The starting form's "ความพึงพอใจโดยรวม" (id 5) becomes the core question.
UPDATE "evaluation_questions" SET "is_core" = true, "required" = true WHERE "id" = 5 AND "type" = 'rating';

-- Backfill each evaluation's core score from its answer to that question.
UPDATE "evaluations" e SET "core_rating" = a."rating"
FROM "evaluation_answers" a
JOIN "evaluation_questions" q ON q."id" = a."question_id" AND q."is_core"
WHERE a."evaluation_id" = e."id";
