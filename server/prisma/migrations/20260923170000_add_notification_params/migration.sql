-- Raw data behind a notification's text (ids, dates, location snapshots),
-- so the message catalog can render both Thai and English on every read
-- instead of only the one language baked into title/body at creation time.
ALTER TABLE "notifications" ADD COLUMN "params" JSONB;
