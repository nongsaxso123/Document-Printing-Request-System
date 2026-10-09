-- Who is currently "on duty" for the self-service Claim Code pickup kiosk
-- (routes/kiosk.js) — an Officer signs on for their shift from their own
-- authenticated session; at most one row is open (ended_at IS NULL) at a
-- time.
CREATE TABLE "kiosk_duty_sessions" (
    "id" SERIAL NOT NULL,
    "officer_email" TEXT NOT NULL,
    "officer_name" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "ended_reason" TEXT,

    CONSTRAINT "kiosk_duty_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "kiosk_duty_sessions_ended_at_idx" ON "kiosk_duty_sessions"("ended_at");
