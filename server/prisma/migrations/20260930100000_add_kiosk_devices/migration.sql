-- Which physical browser is allowed to load /kiosk at all (see
-- schema.prisma's KioskDevice comment).
CREATE TABLE "kiosk_devices" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "registered_by_email" TEXT NOT NULL,
    "registered_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "kiosk_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kiosk_devices_token_key" ON "kiosk_devices"("token");
