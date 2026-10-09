-- Self-service "My Profile" info, one row per user email, any role.
CREATE TABLE "profiles" (
    "email" TEXT NOT NULL,
    "prefix" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "workplace" TEXT,
    "position" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("email")
);
