-- Counter Handover accountability record: replaces the ID-card-number field
-- with the Receiver's position (job title) and work phone number instead.
-- This is deliberately not an identity-verification step — no physical ID
-- is inspected at handover (see file.md FR-14 / Appendix A, which already
-- specified Receiver_Position and Receiver_Work_Phone; the schema simply
-- hadn't caught up yet).
ALTER TABLE "requests" ADD COLUMN "receiver_position" TEXT;
ALTER TABLE "requests" ADD COLUMN "receiver_work_phone" TEXT;
ALTER TABLE "requests" DROP COLUMN "receiver_id_info";
