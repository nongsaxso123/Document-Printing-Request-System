-- Computer Crime Act (พ.ร.บ.คอมพิวเตอร์) s.26: a service provider keeps
-- traffic data (who, what, when, from where) for at least 90 days.

-- "From where": the visitor's IP address. NULL for rows written before this
-- migration and for rows written outside an HTTP request (scripts).
ALTER TABLE "audit_log" ADD COLUMN "ip_address" TEXT;

-- The log is append-only and every row is kept at least 90 days, enforced
-- in the database itself so no app bug, script or manual SQL can rewrite
-- or remove recent history:
--   UPDATE            always refused (a log entry is never edited)
--   DELETE            refused for rows younger than 90 days
--   TRUNCATE          refused (it would skip the per-row check above)
-- created_at is stored by Prisma as UTC without a time zone, so "now" is
-- taken in UTC too.
CREATE FUNCTION "audit_log_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_log is append-only: rows cannot be updated';
  ELSIF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'audit_log cannot be truncated: rows must be kept at least 90 days (Computer Crime Act s.26)';
  ELSIF OLD."created_at" > (now() AT TIME ZONE 'UTC') - INTERVAL '90 days' THEN
    RAISE EXCEPTION 'audit_log row % is younger than 90 days and cannot be deleted (Computer Crime Act s.26)', OLD."id";
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_log_no_update_or_early_delete"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_guard"();

CREATE TRIGGER "audit_log_no_truncate"
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_guard"();

-- Login history is looked up by person and by time.
CREATE INDEX "audit_log_actor_email_created_at_idx" ON "audit_log"("actor_email", "created_at");
