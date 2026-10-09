-- Officer picks where finished copies can be collected when marking a
-- request ready (id follows the Location row, snapshot is what was true then).
ALTER TABLE "requests" ADD COLUMN "pickup_location_id" INTEGER;
ALTER TABLE "requests" ADD COLUMN "pickup_location_snapshot" JSONB;
ALTER TABLE "requests" ADD CONSTRAINT "requests_pickup_location_id_fkey"
    FOREIGN KEY ("pickup_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Requests already waiting for pickup were told the default pickup place
-- (the "ready" email used it), so record that as their pickup place. Requests
-- still printing get theirs when the Officer marks them ready.
UPDATE "requests" r
SET "pickup_location_id" = l."id",
    "pickup_location_snapshot" = jsonb_build_object(
        'id', l."id", 'nameTh', l."name_th", 'nameEn', l."name_en",
        'detailTh', l."detail_th", 'detailEn', l."detail_en",
        'hoursTh', l."hours_th", 'hoursEn', l."hours_en",
        'phone', l."phone", 'mapUrl', l."map_url")
FROM (SELECT * FROM "locations" WHERE "is_default_pickup" AND "is_active" LIMIT 1) l
WHERE r."status" = 'READY_FOR_PICKUP';
