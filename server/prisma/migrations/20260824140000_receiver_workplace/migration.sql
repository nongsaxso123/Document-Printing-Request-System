-- Counter Handover accountability record gains a fourth field: the
-- Receiver's workplace/agency, alongside name, position, and work phone.
-- Still deliberately not an identity-verification step (see FR-14).
ALTER TABLE "requests" ADD COLUMN "receiver_workplace" TEXT;
