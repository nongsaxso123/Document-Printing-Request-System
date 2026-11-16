-- Admin-editable evaluation form (2026-11-13): sections + questions + one row
-- per answer, replacing the five fixed rating columns on "evaluations".
-- Existing evaluations are carried over: the old five ratings and the
-- comment become the starting form, and every past answer is copied into
-- evaluation_answers before the old columns are dropped.

-- CreateTable
CREATE TABLE "evaluation_sections" (
    "id" SERIAL NOT NULL,
    "title_th" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_by_admin_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evaluation_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_questions" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "text_th" TEXT NOT NULL,
    "text_en" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB NOT NULL DEFAULT '[]',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_by_admin_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evaluation_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_answers" (
    "id" SERIAL NOT NULL,
    "evaluation_id" INTEGER NOT NULL,
    "question_id" INTEGER,
    "question_type" TEXT NOT NULL,
    "question_text_th" TEXT NOT NULL,
    "question_text_en" TEXT NOT NULL,
    "section_title_th" TEXT NOT NULL,
    "section_title_en" TEXT NOT NULL,
    "rating" INTEGER,
    "text" TEXT,
    "choices" JSONB,
    CONSTRAINT "evaluation_answers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evaluation_questions_section_id_idx" ON "evaluation_questions"("section_id");
CREATE INDEX "evaluation_answers_evaluation_id_idx" ON "evaluation_answers"("evaluation_id");
CREATE INDEX "evaluation_answers_question_id_idx" ON "evaluation_answers"("question_id");

ALTER TABLE "evaluation_questions" ADD CONSTRAINT "evaluation_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "evaluation_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluation_answers" ADD CONSTRAINT "evaluation_answers_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluation_answers" ADD CONSTRAINT "evaluation_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "evaluation_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starting form = the old fixed form (same wording as the old page).
INSERT INTO "evaluation_sections" ("id", "title_th", "title_en", "sort_order") VALUES
  (1, 'ความพึงพอใจต่อการให้บริการ', 'Service Satisfaction', 1),
  (2, 'ข้อเสนอแนะ', 'Suggestions', 2);

INSERT INTO "evaluation_questions" ("id", "section_id", "type", "text_th", "text_en", "required", "sort_order") VALUES
  (1, 1, 'rating', 'การให้บริการของเจ้าหน้าที่', 'Staff Service', true, 1),
  (2, 1, 'rating', 'ความสะดวกในการใช้งานระบบออนไลน์', 'Ease of Using the Online System', true, 2),
  (3, 1, 'rating', 'ความรวดเร็วในการดำเนินการ', 'Processing Speed', true, 3),
  (4, 1, 'rating', 'คุณภาพงานพิมพ์ที่ได้รับ', 'Print Quality', true, 4),
  (5, 1, 'rating', 'ความพึงพอใจโดยรวม', 'Overall Satisfaction', true, 5),
  (6, 2, 'text', 'ความคิดเห็นเพิ่มเติม', 'Additional Comments', false, 1);

SELECT setval(pg_get_serial_sequence('"evaluation_sections"', 'id'), 2);
SELECT setval(pg_get_serial_sequence('"evaluation_questions"', 'id'), 6);

-- Copy every past answer, with the question/section text as it was.
INSERT INTO "evaluation_answers" ("evaluation_id", "question_id", "question_type", "question_text_th", "question_text_en", "section_title_th", "section_title_en", "rating")
SELECT e."id", q."id", 'rating', q."text_th", q."text_en", s."title_th", s."title_en",
       CASE q."id" WHEN 1 THEN e."rating_staff_service" WHEN 2 THEN e."rating_system_ease" WHEN 3 THEN e."rating_speed"
                   WHEN 4 THEN e."rating_print_quality" ELSE e."rating_overall" END
FROM "evaluations" e
CROSS JOIN "evaluation_questions" q
JOIN "evaluation_sections" s ON s."id" = q."section_id"
WHERE q."id" BETWEEN 1 AND 5;

INSERT INTO "evaluation_answers" ("evaluation_id", "question_id", "question_type", "question_text_th", "question_text_en", "section_title_th", "section_title_en", "text")
SELECT e."id", 6, 'text', 'ความคิดเห็นเพิ่มเติม', 'Additional Comments', 'ข้อเสนอแนะ', 'Suggestions', e."comment"
FROM "evaluations" e
WHERE e."comment" IS NOT NULL AND btrim(e."comment") <> '';

-- AlterTable: summary column replaces the five rating columns.
ALTER TABLE "evaluations" ADD COLUMN "average_rating" DOUBLE PRECISION;
UPDATE "evaluations" SET "average_rating" =
  ("rating_staff_service" + "rating_system_ease" + "rating_speed" + "rating_print_quality" + "rating_overall") / 5.0;
ALTER TABLE "evaluations" DROP COLUMN "rating_overall",
DROP COLUMN "rating_print_quality",
DROP COLUMN "rating_speed",
DROP COLUMN "rating_staff_service",
DROP COLUMN "rating_system_ease";

-- AlterTable: how long after pickup an evaluation can still be given.
ALTER TABLE "system_settings" ADD COLUMN "evaluation_window_unit" TEXT NOT NULL DEFAULT 'day',
ADD COLUMN "evaluation_window_value" INTEGER DEFAULT 30;
