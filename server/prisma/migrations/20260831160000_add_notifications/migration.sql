-- In-app notification feed (bell icon). recipient_email is a plain string,
-- not an FK — same reasoning as requests.reviewed_by_officer_email: Admin
-- can also receive these without an officers-table row, and a notification
-- should survive even if its source request were ever removed.
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "request_reference_no" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_email_is_read_idx" ON "notifications"("recipient_email", "is_read");
