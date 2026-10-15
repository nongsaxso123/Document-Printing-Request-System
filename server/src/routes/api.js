const express = require("express");
const requests = require("../requests");
const notifications = require("../notifications");
const settings = require("../settings");
const locations = require("../locations");
const agencies = require("../agencies");
const profile = require("../profile");
const auth = require("../auth");
const audit = require("../audit");
const { requireRole } = auth;
const reports = require("../reports");

const router = express.Router();
router.use(express.json());

// Requester's own requests — any logged-in user, scoped to their own email.
router.get("/my-requests", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "not-logged-in" });
    res.json(await requests.listByRequester(req.user.email));
  } catch (err) { next(err); }
});

// Requester withdrawing their own request — only while it's still
// AWAITING_ORIGINAL_DOCUMENT (see requests.js cancel()'s atomic
// status-guarded update, which is what actually enforces the ownership +
// status check, not this route).
router.post("/my-requests/:ref/cancel", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "not-logged-in" });
    const updated = await requests.cancel(req.params.ref, { requesterEmail: req.user.email });
    if (!updated) return res.status(409).json({ error: "not-cancellable" });
    res.json(updated);
  } catch (err) { next(err); }
});

// Powers the dismissible reminder banner on requester/my-requests.ejs —
// the actual submission gate lives server-side in routes/requester.js
// (requireNoPendingEvaluation), this is just for the soft nudge.
router.get("/my-pending-evaluation", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json(null);
    res.json(await requests.getPendingEvaluation(req.user.email));
  } catch (err) { next(err); }
});

// Notification bell — any logged-in user (Requester or Officer/Admin), each
// scoped to their own email, same as /my-requests above.
router.get("/notifications", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json([]);
    res.json(await notifications.list(req.user.email, { limit: req.query.limit }));
  } catch (err) { next(err); }
});

// "My Profile" — any logged-in user, scoped to their own email, same as
// /my-requests above. See src/profile.js.
router.get("/profile", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json(null);
    res.json(await profile.get(req.user.email));
  } catch (err) { next(err); }
});

router.post("/profile", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "not-logged-in" });
    const prefix = req.body.prefix === "อื่นๆ" ? req.body.prefixOther : req.body.prefix;
    const result = await profile.upsert(req.user.email, {
      prefix,
      name: req.body.name,
      phone: req.body.phone,
      agencyCategoryId: req.body.agencyCategoryId,
      agencyUnitId: req.body.agencyUnitId,
      agencyUnitText: req.body.agencyUnitText,
      position: req.body.position
    });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result.profile);
  } catch (err) { next(err); }
});

router.get("/notifications/unread-count", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ count: 0 });
    res.json({ count: await notifications.countUnread(req.user.email) });
  } catch (err) { next(err); }
});

router.post("/notifications/:id/read", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "not-logged-in" });
    res.json({ ok: await notifications.markRead(req.params.id, req.user.email) });
  } catch (err) { next(err); }
});

router.post("/notifications/mark-all-read", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "not-logged-in" });
    await notifications.markAllRead(req.user.email);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.use(requireRole("Officer", "Admin"));

router.get("/requests", async (req, res, next) => {
  try {
    res.json(await requests.list());
  } catch (err) { next(err); }
});

// ---- Excel report exports (src/reports.js) — same filter params as the
// JSON endpoints each page already calls, plus `lang` for the headings.
router.get("/reports/history.xlsx", async (req, res, next) => {
  try {
    const q = req.query;
    const wb = await reports.historyReport({
      status: q.status, agencyCategory: q.agencyCategory, year: q.year, month: q.month,
      q: q.q, fromDate: q.fromDate, toDate: q.toDate
    }, { lang: q.lang, user: req.user.email });
    await reports.sendWorkbook(res, wb, "history", q.lang);
  } catch (err) { next(err); }
});

router.get("/reports/dashboard.xlsx", async (req, res, next) => {
  try {
    const q = req.query;
    const wb = await reports.dashboardReport({
      year: q.year, month: q.month, documentType: q.documentType, paperSource: q.paperSource,
      fromDate: q.fromDate, toDate: q.toDate
    }, { lang: q.lang, user: req.user.email });
    await reports.sendWorkbook(res, wb, "dashboard", q.lang);
  } catch (err) { next(err); }
});

router.get("/reports/evaluations.xlsx", async (req, res, next) => {
  try {
    const q = req.query;
    const wb = await reports.evaluationsReport({
      year: q.year, month: q.month, q: q.q, hasComment: q.hasComment, sort: q.sort
    }, { lang: q.lang, user: req.user.email });
    await reports.sendWorkbook(res, wb, "evaluations", q.lang);
  } catch (err) { next(err); }
});

router.get("/dashboard-summary", async (req, res, next) => {
  try {
    res.json(await requests.dashboardSummary({
      year: req.query.year,
      month: req.query.month,
      documentType: req.query.documentType,
      paperSource: req.query.paperSource,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    }));
  } catch (err) { next(err); }
});

router.get("/evaluations-summary", async (req, res, next) => {
  try {
    res.json(await requests.evaluationsSummary({ year: req.query.year }));
  } catch (err) { next(err); }
});

router.get("/evaluations", async (req, res, next) => {
  try {
    res.json(await requests.searchEvaluations({
      year: req.query.year,
      month: req.query.month,
      q: req.query.q,
      page: req.query.page,
      pageSize: req.query.pageSize,
      hasComment: req.query.hasComment,
      sort: req.query.sort
    }));
  } catch (err) { next(err); }
});

router.get("/requests/awaiting", async (req, res, next) => {
  try {
    res.json(await requests.listAwaiting());
  } catch (err) { next(err); }
});

router.get("/requests/printing", async (req, res, next) => {
  try {
    res.json(await requests.listPrinting());
  } catch (err) { next(err); }
});

router.get("/requests/years", async (req, res, next) => {
  try {
    res.json(await requests.listAvailableYears());
  } catch (err) { next(err); }
});

router.get("/requests/history", async (req, res, next) => {
  try {
    res.json(await requests.searchHistory({
      status: req.query.status,
      agencyCategory: req.query.agencyCategory,
      year: req.query.year,
      month: req.query.month,
      q: req.query.q,
      page: req.query.page,
      pageSize: req.query.pageSize,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    }));
  } catch (err) { next(err); }
});

router.get("/requests/by-claim/:code", async (req, res, next) => {
  try {
    const record = await requests.getByClaimCode(req.params.code);
    res.json(record);
  } catch (err) { next(err); }
});

// Counter Handover's "receiver is the requester" autofill (see
// counter-handover.ejs's same-as-requester-btn) — the matched Request
// itself has no position field (only Profile does), so this is the one
// place an Officer looks up someone else's saved Profile by email rather
// than their own. Never errors on a missing profile — no profile yet, or
// no position saved on it, is a normal case (position just stays blank for
// the Officer to type), not a lookup failure.
router.get("/profile/by-email/:email", async (req, res, next) => {
  try {
    const found = await profile.get(req.params.email);
    res.json({ position: (found && found.position) || null });
  } catch (err) { next(err); }
});

router.get("/requests/:ref", async (req, res, next) => {
  try {
    const record = await requests.getByRef(req.params.ref);
    if (!record) return res.status(404).json(null);
    res.json(record);
  } catch (err) { next(err); }
});

router.post("/requests/:ref/approve", async (req, res, next) => {
  try {
    const updated = await requests.approve(req.params.ref, {
      confirmedDate: req.body.confirmedDate,
      officerEmail: req.user.email,
      // Prefers the Officer's own saved Profile name (prefix + name) over
      // the bare Google account display name — see profile.js.
      officerName: await profile.resolveDisplayName(req.user.email, req.user.name)
    });
    if (!updated) return res.status(409).json({ error: "not-awaiting" });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post("/requests/:ref/reject", async (req, res, next) => {
  try {
    const updated = await requests.reject(req.params.ref, {
      reason: req.body.reason,
      officerEmail: req.user.email,
      officerName: await profile.resolveDisplayName(req.user.email, req.user.name)
    });
    if (!updated) return res.status(409).json({ error: "not-awaiting" });
    res.json(updated);
  } catch (err) { next(err); }
});

// Places an Officer can pick as the pickup point when marking a request ready.
router.get("/locations/pickup", async (req, res, next) => {
  try {
    const options = await locations.listActive("pickup");
    res.json(options.map((l) => ({ ...locations.snapshotOf(l), isDefault: l.isDefaultPickup })));
  } catch (err) { next(err); }
});

router.post("/requests/:ref/ready", async (req, res, next) => {
  try {
    const updated = await requests.markReady(req.params.ref, {
      pickupLocationId: req.body.pickupLocationId,
      pickupAvailableFrom: req.body.pickupAvailableFrom
    });
    if (!updated) return res.status(409).json({ error: "not-printing" });
    if (updated.error) return res.status(400).json({ error: updated.error });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post("/requests/:ref/handover", async (req, res, next) => {
  try {
    const updated = await requests.handover(req.params.ref, {
      receiverName: req.body.receiverName,
      receiverPosition: req.body.receiverPosition,
      receiverWorkplace: req.body.receiverWorkplace,
      receiverWorkPhone: req.body.receiverWorkPhone,
      officerEmail: req.user.email,
      officerName: await profile.resolveDisplayName(req.user.email, req.user.name)
    });
    if (!updated) return res.status(409).json({ error: "not-ready" });
    res.json(updated);
  } catch (err) { next(err); }
});

// FR-02 — Admin-only Officer account management.
function officerToJSON(o) {
  return {
    name: o.name,
    email: o.email,
    assignedBy: o.assignedBy,
    assignedDate: o.assignedDate.toISOString().slice(0, 10),
    isAdmin: !!o.isAdmin,
    adminGrantedBy: o.adminGrantedBy || null,
    adminGrantedAt: o.adminGrantedAt ? o.adminGrantedAt.toISOString() : null
  };
}

router.get("/admin/officers", auth.requireAdmin, async (req, res, next) => {
  try {
    const officers = await auth.officers.list();
    res.json(officers.map(officerToJSON));
  } catch (err) { next(err); }
});

router.post("/admin/officers", auth.requireAdmin, async (req, res, next) => {
  try {
    const { name, email, isAdmin } = req.body;
    if (!name || !email) return res.status(400).json({ error: "name-and-email-required" });
    const result = await auth.officers.add(email, name, req.user.email, { isAdmin: !!isAdmin });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(officerToJSON(result.officer));
  } catch (err) { next(err); }
});

router.get("/admin/settings", auth.requireAdmin, async (req, res, next) => {
  try {
    res.json(await settings.get());
  } catch (err) { next(err); }
});

// The fields the audit log compares for a settings change.
function settingsSnapshot(s) {
  const iso = (d) => (d ? new Date(d).toISOString() : null);
  return {
    officerEmailNotificationsEnabled: !!s.officerEmailNotificationsEnabled,
    maintenanceModeEnabled: !!s.maintenanceModeEnabled,
    maintenanceStartsAt: iso(s.maintenanceStartsAt),
    maintenanceEndsAt: iso(s.maintenanceEndsAt),
    maintenanceMessage: s.maintenanceMessage || null,
    maintenanceMessageEn: s.maintenanceMessageEn || null,
    contactPhone: s.contactPhone || null,
    contactEmail: s.contactEmail || null
  };
}

// Blank/missing -> null (open-ended); anything else must parse as a date.
function parseOptionalDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

router.post("/admin/settings/system", auth.requireAdmin, async (req, res, next) => {
  try {
    const maintenanceModeEnabled = !!req.body.maintenanceModeEnabled;
    const maintenanceStartsAt = parseOptionalDate(req.body.maintenanceStartsAt);
    const maintenanceEndsAt = parseOptionalDate(req.body.maintenanceEndsAt);
    if (maintenanceStartsAt === undefined || maintenanceEndsAt === undefined) {
      return res.status(400).json({ error: "maintenance-date-invalid" });
    }
    if (maintenanceStartsAt && maintenanceEndsAt && maintenanceEndsAt <= maintenanceStartsAt) {
      return res.status(400).json({ error: "maintenance-end-before-start" });
    }
    const contactEmail = req.body.contactEmail ? String(req.body.contactEmail).trim() : "";
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return res.status(400).json({ error: "contact-email-invalid" });
    }
    if (maintenanceModeEnabled && maintenanceEndsAt && maintenanceEndsAt <= new Date()) {
      return res.status(400).json({ error: "maintenance-end-in-past" });
    }

    const before = await settings.get();
    const updated = await settings.update({
      officerEmailNotificationsEnabled: !!req.body.officerEmailNotificationsEnabled,
      maintenanceModeEnabled,
      maintenanceStartsAt,
      maintenanceEndsAt,
      maintenanceMessage: req.body.maintenanceMessage ? String(req.body.maintenanceMessage).trim() : null,
      maintenanceMessageEn: req.body.maintenanceMessageEn ? String(req.body.maintenanceMessageEn).trim() : null,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail
    }, req.user.email);
    await audit.write(null, {
      actorEmail: req.user.email, action: "settings.update", entityType: "settings", entityLabel: "—",
      before: settingsSnapshot(before), after: settingsSnapshot(updated)
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// Drop-off / pickup places (src/locations.js). Archive/restore instead of
// delete, so requests that already point at a place keep a name to show.
const LOCATION_ERROR_STATUS = {
  "not-found": 404, "last-dropoff": 409, "last-pickup": 409,
  "replacement-required": 409, "replacement-invalid": 400, "replacement-purpose-mismatch": 400
};

function sendLocationResult(res, result, extra) {
  if (result.error) return res.status(LOCATION_ERROR_STATUS[result.error] || 400).json({ error: result.error });
  res.json({ ...locations.toAdminJSON(result.location), ...extra });
}

router.get("/admin/locations", auth.requireAdmin, async (req, res, next) => {
  try {
    const list = await locations.listAll();
    const inFlightMap = await requests.countInFlightByLocation();
    res.json(list.map((l) => ({ ...locations.toAdminJSON(l), inFlight: inFlightMap[l.id] || { dropoff: 0, pickup: 0 } })));
  } catch (err) { next(err); }
});

router.post("/admin/locations", auth.requireAdmin, async (req, res, next) => {
  try {
    sendLocationResult(res, await locations.create(req.body, req.user.email));
  } catch (err) { next(err); }
});

// notifyMoved (from the admin's typo-fix/actually-moved choice — only
// offered when the place has in-flight requests, see GET above) tells every
// in-flight requester the place changed; a plain edit relies on their live
// pages already reflecting the new data (getByRef/getByClaimCode use the
// relation, not the snapshot) and sends nothing.
router.post("/admin/locations/:id", auth.requireAdmin, async (req, res, next) => {
  try {
    const before = await locations.getById(req.params.id);
    const result = await locations.update(req.params.id, req.body, req.user.email);

    // Both purposes are attempted regardless of the place's current
    // accepts* flags — an in-flight request only cares whether it still
    // points at this location id, not whether the flag that offered it as
    // a choice is still on (notifyLocationChange no-ops when there's
    // nothing in-flight for that purpose anyway).
    let notifiedCount = 0;
    if (!result.error && before && req.body.notifyMoved) {
      const oldLocation = locations.snapshotOf(before);
      const newLocation = locations.snapshotOf(result.location);
      notifiedCount += await requests.notifyLocationChange({ purpose: "dropoff", fromLocationId: before.id, toLocationId: before.id, oldLocation, newLocation });
      notifiedCount += await requests.notifyLocationChange({ purpose: "pickup", fromLocationId: before.id, toLocationId: before.id, oldLocation, newLocation });
    }
    sendLocationResult(res, result, { notifiedCount });
  } catch (err) { next(err); }
});

// Archiving a place that still has in-flight requests requires a
// replacement (must itself be active and accept whichever purpose(s) have
// in-flight requests) — those requests are moved onto it and their
// requesters notified. Restoring, or archiving a place nobody's still
// waiting on, needs no replacementId.
router.post("/admin/locations/:id/active", auth.requireAdmin, async (req, res, next) => {
  try {
    const isActive = !!req.body.isActive;
    let notifiedCount = 0;

    if (!isActive) {
      const target = await locations.getById(req.params.id);
      const inFlight = target ? await requests.countInFlightForLocation(target.id) : { dropoff: 0, pickup: 0 };
      if (target && (inFlight.dropoff > 0 || inFlight.pickup > 0)) {
        const replacementId = parseInt(req.body.replacementId, 10);
        const replacement = replacementId ? await locations.getById(replacementId) : null;
        if (!replacement || !replacement.isActive || replacement.id === target.id) {
          return res.status(409).json({ error: "replacement-required", inFlight });
        }
        if (inFlight.dropoff > 0 && !replacement.acceptsDropoff) return res.status(400).json({ error: "replacement-purpose-mismatch" });
        if (inFlight.pickup > 0 && !replacement.acceptsPickup) return res.status(400).json({ error: "replacement-purpose-mismatch" });

        const oldLocation = locations.snapshotOf(target);
        const newLocation = locations.snapshotOf(replacement);
        if (inFlight.dropoff > 0) notifiedCount += await requests.notifyLocationChange({ purpose: "dropoff", fromLocationId: target.id, toLocationId: replacement.id, oldLocation, newLocation });
        if (inFlight.pickup > 0) notifiedCount += await requests.notifyLocationChange({ purpose: "pickup", fromLocationId: target.id, toLocationId: replacement.id, oldLocation, newLocation });
      }
    }

    sendLocationResult(res, await locations.setActive(req.params.id, isActive, req.user.email), { notifiedCount });
  } catch (err) { next(err); }
});

router.post("/admin/locations/:id/delete", auth.requireAdmin, async (req, res, next) => {
  try {
    const result = await locations.remove(req.params.id, req.user.email);
    if (result.error === "in-use") return res.status(409).json({ error: "in-use", count: result.count });
    if (result.error) return res.status(LOCATION_ERROR_STATUS[result.error] || 400).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post("/admin/locations/:id/move", auth.requireAdmin, async (req, res, next) => {
  try {
    const result = await locations.move(req.params.id, req.body.direction === "up" ? "up" : "down");
    if (result.error) return res.status(LOCATION_ERROR_STATUS[result.error] || 400).json({ error: result.error });
    res.json((await locations.listAll()).map(locations.toAdminJSON));
  } catch (err) { next(err); }
});

// Agency directory (src/agencies.js). Archive/restore instead of delete for
// a category/unit any Request or Profile has used, same reasoning as
// Locations. "categories" here always means the admin's flat, all-rows list
// (bilingual labels for officer views like history/dashboard) — new-request
// and profile pass their own active-with-units list in as a render local
// instead (see routes/requester.js, src/app.js's /profile route), since
// both are full-page (non-fetch) form submissions.
const AGENCY_ERROR_STATUS = {
  "not-found": 404, "last-category": 409, "last-freetext": 409, "has-units": 409,
  "category-required": 400, "category-invalid": 400
};

function sendAgencyResult(res, result, key, toJSON) {
  if (result.error) return res.status(AGENCY_ERROR_STATUS[result.error] || 400).json({ error: result.error, count: result.count });
  res.json(toJSON(result[key]));
}

// Read-only, all categories (active + archived — a historical request can
// reference an archived one) for Officer-side label/filter lookups
// (history.ejs, queue.ejs, dashboard.ejs, request-detail.ejs). Just needs
// the Officer/Admin gate this whole router section already sits behind,
// not Admin specifically.
router.get("/agencies/categories", async (req, res, next) => {
  try {
    res.json((await agencies.listAllCategories()).map(agencies.categoryAdminJSON));
  } catch (err) { next(err); }
});

router.get("/admin/agencies/categories", auth.requireAdmin, async (req, res, next) => {
  try {
    res.json((await agencies.listAllCategoriesWithUnitCount()).map(agencies.categoryAdminJSON));
  } catch (err) { next(err); }
});

router.post("/admin/agencies/categories", auth.requireAdmin, async (req, res, next) => {
  try {
    sendAgencyResult(res, await agencies.createCategory(req.body, req.user.email), "category", agencies.categoryAdminJSON);
  } catch (err) { next(err); }
});

router.post("/admin/agencies/categories/:id", auth.requireAdmin, async (req, res, next) => {
  try {
    sendAgencyResult(res, await agencies.updateCategory(req.params.id, req.body, req.user.email), "category", agencies.categoryAdminJSON);
  } catch (err) { next(err); }
});

router.post("/admin/agencies/categories/:id/active", auth.requireAdmin, async (req, res, next) => {
  try {
    sendAgencyResult(res, await agencies.setCategoryActive(req.params.id, !!req.body.isActive, req.user.email), "category", agencies.categoryAdminJSON);
  } catch (err) { next(err); }
});

router.post("/admin/agencies/categories/:id/delete", auth.requireAdmin, async (req, res, next) => {
  try {
    const result = await agencies.removeCategory(req.params.id, req.user.email);
    if (result.error) return res.status(AGENCY_ERROR_STATUS[result.error] || 400).json({ error: result.error, count: result.count });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post("/admin/agencies/categories/:id/move", auth.requireAdmin, async (req, res, next) => {
  try {
    const result = await agencies.moveCategory(req.params.id, req.body.direction === "up" ? "up" : "down");
    if (result.error) return res.status(AGENCY_ERROR_STATUS[result.error] || 400).json({ error: result.error });
    res.json((await agencies.listAllCategoriesWithUnitCount()).map(agencies.categoryAdminJSON));
  } catch (err) { next(err); }
});

router.get("/admin/agencies/categories/:id/units", auth.requireAdmin, async (req, res, next) => {
  try {
    res.json((await agencies.listUnitsForCategory(req.params.id)).map(agencies.unitAdminJSON));
  } catch (err) { next(err); }
});

router.post("/admin/agencies/units", auth.requireAdmin, async (req, res, next) => {
  try {
    sendAgencyResult(res, await agencies.createUnit(req.body, req.user.email), "unit", agencies.unitAdminJSON);
  } catch (err) { next(err); }
});

router.post("/admin/agencies/units/:id", auth.requireAdmin, async (req, res, next) => {
  try {
    sendAgencyResult(res, await agencies.updateUnit(req.params.id, req.body, req.user.email), "unit", agencies.unitAdminJSON);
  } catch (err) { next(err); }
});

router.post("/admin/agencies/units/:id/active", auth.requireAdmin, async (req, res, next) => {
  try {
    sendAgencyResult(res, await agencies.setUnitActive(req.params.id, !!req.body.isActive, req.user.email), "unit", agencies.unitAdminJSON);
  } catch (err) { next(err); }
});

router.post("/admin/agencies/units/:id/delete", auth.requireAdmin, async (req, res, next) => {
  try {
    const result = await agencies.removeUnit(req.params.id, req.user.email);
    if (result.error) return res.status(AGENCY_ERROR_STATUS[result.error] || 400).json({ error: result.error, count: result.count });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post("/admin/agencies/units/:id/move", auth.requireAdmin, async (req, res, next) => {
  try {
    const result = await agencies.moveUnit(req.params.id, req.body.direction === "up" ? "up" : "down");
    if (result.error) return res.status(AGENCY_ERROR_STATUS[result.error] || 400).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get("/admin/audit-log", auth.requireAdmin, async (req, res, next) => {
  try {
    res.json(await audit.list({
      entityType: req.query.entityType,
      action: req.query.action,
      actorEmail: req.query.actorEmail,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: req.query.page,
      pageSize: req.query.pageSize
    }));
  } catch (err) { next(err); }
});

router.get("/admin/audit-log/actors", auth.requireAdmin, async (req, res, next) => {
  try {
    res.json(await audit.listActors({ entityType: req.query.entityType }));
  } catch (err) { next(err); }
});

router.post("/admin/officers/:email/remove", auth.requireAdmin, async (req, res, next) => {
  try {
    const result = await auth.officers.remove(req.params.email, req.user.email);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Grant / revoke the in-app Admin role on an existing Officer.
router.post("/admin/officers/:email/admin", auth.requireAdmin, async (req, res, next) => {
  try {
    const result = await auth.officers.setAdmin(req.params.email, !!(req.body && req.body.isAdmin), req.user.email);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(officerToJSON(result.officer));
  } catch (err) { next(err); }
});

module.exports = router;
