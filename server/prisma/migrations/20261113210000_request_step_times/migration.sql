-- When each step of a request happened, shown in the Request Form's
-- sign-off cells. Older rows keep NULL (the form just leaves that line out).
ALTER TABLE "requests" ADD COLUMN "rejected_at" TIMESTAMP(3);
ALTER TABLE "requests" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "requests" ADD COLUMN "ready_at" TIMESTAMP(3);
ALTER TABLE "requests" ADD COLUMN "marked_ready_by_officer_email" TEXT;
ALTER TABLE "requests" ADD COLUMN "marked_ready_by_officer_name" TEXT;
