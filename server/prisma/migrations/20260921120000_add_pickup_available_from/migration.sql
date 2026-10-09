-- When the Requester may start collecting the finished copies, picked by the
-- Officer when marking a request ready.
ALTER TABLE "requests" ADD COLUMN "pickup_available_from" TIMESTAMP(3);
