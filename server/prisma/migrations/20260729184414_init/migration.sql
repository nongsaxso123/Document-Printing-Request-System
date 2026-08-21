-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('AWAITING_ORIGINAL_DOCUMENT', 'REJECTED', 'PRINTING_IN_PROGRESS', 'READY_FOR_PICKUP', 'COMPLETED');

-- CreateTable
CREATE TABLE "officers" (
    "officer_email" TEXT NOT NULL,
    "officer_name" TEXT NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "assigned_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "officers_pkey" PRIMARY KEY ("officer_email")
);

-- CreateTable
CREATE TABLE "requests" (
    "request_reference_no" TEXT NOT NULL,
    "run_number" TEXT,
    "requester_email" TEXT NOT NULL,
    "requester_name" TEXT NOT NULL,
    "requester_tel" TEXT NOT NULL,
    "agency_category" TEXT NOT NULL,
    "agency_unit" TEXT NOT NULL,
    "paper_size" TEXT NOT NULL,
    "print_option" TEXT NOT NULL,
    "finishing_option" TEXT,
    "binding_option" TEXT,
    "folding_option" TEXT,
    "item_list" TEXT NOT NULL,
    "original_pages" INTEGER NOT NULL,
    "number_of_copies" INTEGER NOT NULL,
    "submission_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "original_doc_deadline" TIMESTAMP(3) NOT NULL,
    "original_doc_received_timestamp" TIMESTAMP(3),
    "appointment_date_proposed" DATE NOT NULL,
    "appointment_date_confirmed" DATE,
    "request_form_file" TEXT,
    "claim_code" TEXT,
    "status" "request_status" NOT NULL DEFAULT 'AWAITING_ORIGINAL_DOCUMENT',
    "reviewed_by_officer_email" TEXT,
    "reviewed_by_officer_name" TEXT,
    "handed_over_by_officer_email" TEXT,
    "handed_over_by_officer_name" TEXT,
    "rejection_reason" TEXT,
    "receiver_name" TEXT,
    "receiver_id_info" TEXT,
    "completed_timestamp" TIMESTAMP(3),

    CONSTRAINT "requests_pkey" PRIMARY KEY ("request_reference_no")
);

-- CreateTable
CREATE TABLE "counters" (
    "counter_type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("counter_type","year")
);

-- CreateIndex
CREATE UNIQUE INDEX "requests_run_number_key" ON "requests"("run_number");
