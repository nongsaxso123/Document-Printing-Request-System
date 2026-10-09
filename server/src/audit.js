/**
 * "Who changed what, when" for admin-editable reference data — Location
 * today (see src/locations.js, which calls write() from inside its own
 * transactions so a log row never survives a rolled-back write), Agencies
 * later on the same table. Read by the admin page at /admin/audit-log.
 *
 * before/after are plain snapshots of the fields that matter for that
 * entity type (see auditSnapshot() in locations.js), not the raw DB row —
 * this table already carries actorEmail/createdAt, so there's no need to
 * duplicate updatedByAdminEmail/updatedAt inside the JSON too.
 */

const prisma = require("./prisma");

// `tx` lets a caller write the audit row inside its own transaction (so a
// rolled-back change never leaves a log entry behind); omit it to write
// directly, e.g. from a one-off script.
async function write(tx, { actorEmail, action, entityType, entityId, entityLabel, before, after }) {
  await (tx || prisma).auditLog.create({
    data: {
      actorEmail,
      action,
      entityType,
      entityId: entityId == null ? null : Number(entityId),
      entityLabel: entityLabel || null,
      before: before === undefined ? null : before,
      after: after === undefined ? null : after
    }
  });
}

function buildWhere({ entityType, action, actorEmail, dateFrom, dateTo }) {
  const where = {};
  if (entityType) where.entityType = entityType;
  if (action) where.action = action;
  if (actorEmail) where.actorEmail = actorEmail;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    // dateTo is a plain "YYYY-MM-DD" from a date input — push it to the end
    // of that day so the filter includes changes made on that date, not
    // only ones before its midnight.
    if (dateFrom) where.createdAt.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999");
  }
  return where;
}

// Paginated (page is 1-indexed, same convention as requests.searchHistory)
// — the admin page's page-size selector and prev/next controls need
// `total` to know how many pages exist, not just the current page's rows.
async function list({ entityType, action, actorEmail, dateFrom, dateTo, page, pageSize } = {}) {
  const where = buildWhere({ entityType, action, actorEmail, dateFrom, dateTo });
  const take = Math.max(1, Math.min(200, parseInt(pageSize, 10) || 50));
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const skip = (currentPage - 1) * take;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
    prisma.auditLog.count({ where })
  ]);

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      actorEmail: r.actorEmail,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      entityLabel: r.entityLabel,
      before: r.before,
      after: r.after,
      createdAt: r.createdAt.toISOString()
    }))
  };
}

// Distinct "who" values to populate the actor filter's <select> — the
// action filter doesn't need this, its options are the fixed, known set of
// audit actions (see ACTION_KEYS in audit-log.ejs).
async function listActors({ entityType } = {}) {
  const rows = await prisma.auditLog.findMany({
    where: entityType ? { entityType } : undefined,
    select: { actorEmail: true },
    distinct: ["actorEmail"],
    orderBy: { actorEmail: "asc" }
  });
  return rows.map((r) => r.actorEmail);
}

module.exports = { write, list, listActors };
