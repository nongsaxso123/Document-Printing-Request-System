-- Fill the step times added in 20261113210000 for requests that already
-- went through that step, using the moment the matching notification was
-- sent (the notification is created by the same action). Rows with no such
-- notification stay NULL and the Request Form shows "not recorded".

UPDATE "requests" r SET "rejected_at" = n.t
FROM (SELECT "request_reference_no" AS ref, MIN("created_at") AS t
      FROM "notifications" WHERE "type" = 'rejected' AND "request_reference_no" IS NOT NULL
      GROUP BY 1) n
WHERE r."request_reference_no" = n.ref AND r."status" = 'REJECTED' AND r."rejected_at" IS NULL;

UPDATE "requests" r SET "cancelled_at" = n.t
FROM (SELECT "request_reference_no" AS ref, MIN("created_at") AS t
      FROM "notifications" WHERE "type" = 'cancelled' AND "request_reference_no" IS NOT NULL
      GROUP BY 1) n
WHERE r."request_reference_no" = n.ref AND r."status" = 'CANCELLED' AND r."cancelled_at" IS NULL;

UPDATE "requests" r SET "ready_at" = n.t
FROM (SELECT "request_reference_no" AS ref, MIN("created_at") AS t
      FROM "notifications" WHERE "type" = 'ready' AND "request_reference_no" IS NOT NULL
      GROUP BY 1) n
WHERE r."request_reference_no" = n.ref AND r."status" IN ('READY_FOR_PICKUP', 'COMPLETED') AND r."ready_at" IS NULL;
