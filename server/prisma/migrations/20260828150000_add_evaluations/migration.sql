-- Post-completion satisfaction survey: one row per completed Request.
-- First real foreign key in this schema (every other cross-entity
-- reference elsewhere is denormalized email+name) since this one genuinely
-- needs referential integrity — a stray evaluation row for a deleted
-- request would be meaningless.
CREATE TABLE "evaluations" (
    "id" SERIAL NOT NULL,
    "request_reference_no" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL,
    "rating_staff_service" INTEGER NOT NULL,
    "rating_system_ease" INTEGER NOT NULL,
    "rating_speed" INTEGER NOT NULL,
    "rating_print_quality" INTEGER NOT NULL,
    "rating_overall" INTEGER NOT NULL,
    "comment" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_request_reference_no_key" ON "evaluations"("request_reference_no");

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_request_reference_no_fkey" FOREIGN KEY ("request_reference_no") REFERENCES "requests"("request_reference_no") ON DELETE RESTRICT ON UPDATE CASCADE;
