-- Requester-initiated cancellation, only reachable from
-- AWAITING_ORIGINAL_DOCUMENT (see requests.js cancel()) — lets a requester
-- withdraw and resubmit a request they want to correct, instead of an
-- in-place edit racing the Officer's own approve/reject at the counter.
ALTER TYPE "request_status" ADD VALUE 'CANCELLED';
