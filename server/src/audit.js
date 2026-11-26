/**
 * "Who changed what, when" for admin-editable reference data — Location
 * today (see src/locations.js, which calls write() from inside its own
 * transactions so a log row never survives a rolled-back write), Units
 * later on the same table. Read by the admin page at /admin/audit-log.
 *
 * before/after are plain snapshots of the fields that matter for that
 * entity type (see auditSnapshot() in locations.js), not the raw DB row —
 * this table already carries actorEmail/createdAt, so there's no need to
 * duplicate updatedByAdminEmail/updatedAt inside the JSON too.
 */

const { AsyncLocalStorage } = require("node:async_hooks");
const prisma = require("./prisma");

// The visitor's IP address for whatever HTTP request is running right now,
// so every audit row records "from where" without each caller having to
// pass req down (Computer Crime Act s.26 traffic data: who, what, when,
// from where). app.js wraps each request with context.run({ ip: req.ip }).
// req.ip is the real client address because app.js sets "trust proxy".
// Outside a request (a script) there is no store and ipAddress stays null.
const context = new AsyncLocalStorage();
function currentIp() {
  const store = context.getStore();
  const ip = (store && store.ip) || null;
  // "::ffff:203.0.113.7" is just an IPv4 address written the IPv6 way.
  return ip && ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

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
      after: after === undefined ? null : after,
      ipAddress: currentIp()
    }
  });
}

// For events logged after the real work has already succeeded (a login,
// an approved request): a failed log write is reported in the server log
// but must not turn the user's successful action into an error page.
async function record(entry) {
  try {
    await write(null, entry);
  } catch (err) {
    console.error("[audit] could not write", entry.action, err.message);
  }
}

// One step of a printing request's workflow ("request.approve", ...).
// Only the reference number is kept, not the request's contents: s.26
// asks for traffic data (who, what, when, from where), and PDPA data
// minimisation says not to copy names or phone numbers into the log.
function recordRequest(actorEmail, step, referenceNo) {
  return record({ actorEmail, action: "request." + step, entityType: "request", entityLabel: referenceNo });
}

// entityType may be a comma-separated list ("unit_type,unit").
function typeWhere(entityType) {
  const types = String(entityType || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!types.length) return undefined;
  return types.length === 1 ? types[0] : { in: types };
}

function buildWhere({ entityType, action, actorEmail, q, dateFrom, dateTo }) {
  const where = {};
  // Free-text search (Access Log page): part of an email, an IP address or
  // a request reference number, ignoring case.
  const text = String(q || "").trim().slice(0, 100);
  if (text) {
    const contains = { contains: text, mode: "insensitive" };
    where.OR = [{ actorEmail: contains }, { ipAddress: contains }, { entityLabel: contains }];
  }
  if (entityType) where.entityType = typeWhere(entityType);
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
async function list({ entityType, action, actorEmail, q, dateFrom, dateTo, page, pageSize } = {}) {
  const where = buildWhere({ entityType, action, actorEmail, q, dateFrom, dateTo });
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
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString()
    }))
  };
}

// Distinct "who" values to populate the actor filter's <select> — the
// action filter doesn't need this, its options are the fixed, known set of
// audit actions (see ACTION_KEYS in audit-log.ejs).
async function listActors({ entityType } = {}) {
  const rows = await prisma.auditLog.findMany({
    where: entityType ? { entityType: typeWhere(entityType) } : undefined,
    select: { actorEmail: true },
    distinct: ["actorEmail"],
    orderBy: { actorEmail: "asc" }
  });
  return rows.map((r) => r.actorEmail);
}

// A signed-in user refused a page or API call (403). Logged at most once per
// user + path per minute, so repeated clicks or a script can't flood the
// append-only table. `reason` is a short code ("role", "kiosk-only").
const FORBIDDEN_EVERY_MS = 60 * 1000;
const lastForbidden = new Map(); // "email path" -> time
function recordForbidden(req, reason) {
  const actorEmail = (req.user && req.user.email) || "anonymous";
  const path = String(req.originalUrl || req.url || "").split("?")[0].slice(0, 200);
  const k = actorEmail + " " + path;
  const now = Date.now();
  if (now - (lastForbidden.get(k) || 0) < FORBIDDEN_EVERY_MS) return Promise.resolve();
  lastForbidden.set(k, now);
  if (lastForbidden.size > 5000) {
    for (const [key, t] of lastForbidden) if (now - t >= FORBIDDEN_EVERY_MS) lastForbidden.delete(key);
  }
  const entry = { actorEmail, action: "auth.forbidden", entityType: "security", entityLabel: (reason ? reason + " " : "") + req.method + " " + path };
  // The CSRF guard runs before app.js sets up the IP context; give it one.
  if (!context.getStore()) return context.run({ ip: req.ip || null }, () => record(entry));
  return record(entry);
}

// An Excel report was downloaded. `report` names which one
// ("history", "dashboard", "evaluations").
function recordExport(actorEmail, report) {
  return record({ actorEmail, action: "report.export", entityType: "report", entityLabel: report });
}

module.exports = { context, write, record, recordRequest, recordForbidden, recordExport, list, listActors };
