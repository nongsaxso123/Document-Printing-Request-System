const express = require("express");
const auth = require("../auth");
const settings = require("../settings");
const fs = require("fs");
const backup = require("../backup");
const audit = require("../audit");
const prisma = require("../prisma");
const manuals = require("../manuals");

const router = express.Router();
router.use(auth.requireAdmin);

router.get("/officers", (req, res) => {
  res.render("admin/officers", { user: req.user, active: "admin", envAdmins: auth.officers.envAdmins() });
});

router.get("/settings", async (req, res, next) => {
  try {
    const current = await settings.get();
    res.render("admin/settings", { user: req.user, active: "systemSettings", settings: current });
  } catch (err) { next(err); }
});

router.get("/locations", (req, res) => {
  res.render("admin/locations", { user: req.user, active: "adminLocations" });
});

router.get("/audit-log", (req, res) => {
  res.render("admin/audit-log", { user: req.user, active: "adminAuditLog" });
});

router.get("/agencies", (req, res) => {
  res.render("admin/agencies", { user: req.user, active: "adminAgencies" });
});

// ---- Backup & restore (whole database) — see src/backup.js ----
// The page is a list of backup files kept on the server. The admin can
// upload a file, save the current data as a new file, "use" any file
// (replaces all current data with it), delete a file from the list, or
// clear all data. Using a file and clearing both save the current data as
// an automatic file first, so either can be undone by using that file.
//
// Every state-changing call takes a JSON or octet-stream body — an HTML
// form can't send either content type cross-site.
const CLEAR_CONFIRM_PHRASE = "ล้างข้อมูลทั้งหมด";
let restoreInProgress = false;

const BACKUP_ACTIONS = ["backupExport", "backupSnapshot", "backupUpload", "backupRestore", "backupRollback", "backupClear", "backupDelete"];
const HISTORY_WHERE = { entityType: "system", action: { in: BACKUP_ACTIONS } };
const HISTORY_PAGE = 10;

// Shown in confirm messages and the "current data came from" banner.
function displayLabel(file) {
  return file.label || backup.backupFileName(new Date(file.meta.createdAt || file.addedAt), file.kind === "auto" ? "auto" : "snapshot").replace(".json.gz", "");
}

function requireConfirm(req, res) {
  if (!req.body || req.body.confirm !== true) {
    res.status(400).json({ error: "generic" });
    return false;
  }
  return true;
}

// Runs fn with the restore lock held; a second destructive call while one
// is still running gets 409 instead of interleaving with it.
async function withRestoreLock(res, next, fn) {
  if (restoreInProgress) return res.status(409).json({ error: "busy" });
  restoreInProgress = true;
  try {
    await fn();
  } catch (err) {
    if (err instanceof backup.BackupError) return res.status(400).json({ error: err.code, detail: err.detail });
    next(err);
  } finally {
    restoreInProgress = false;
  }
}

router.get("/backup", async (req, res, next) => {
  try {
    const [history, historyTotal, library] = await Promise.all([
      prisma.auditLog.findMany({ where: HISTORY_WHERE, orderBy: { createdAt: "desc" }, take: HISTORY_PAGE }),
      prisma.auditLog.count({ where: HISTORY_WHERE }),
      backup.listFiles()
    ]);
    res.render("admin/backup", {
      user: req.user,
      active: "adminBackup",
      counts: await backup.currentCounts(),
      schemaVersion: await backup.currentSchemaVersion(),
      library,
      maxAutoBackups: backup.MAX_SAFETY_BACKUPS,
      history,
      historyTotal,
      historyPage: HISTORY_PAGE,
      clearPhrase: CLEAR_CONFIRM_PHRASE
    });
  } catch (err) { next(err); }
});

// "Show more" on the history list — it grows forever, so the page only
// renders the first page and fetches the rest on demand.
router.get("/backup/history", async (req, res, next) => {
  try {
    const skip = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const rows = await prisma.auditLog.findMany({ where: HISTORY_WHERE, orderBy: { createdAt: "desc" }, skip, take: HISTORY_PAGE });
    res.json({
      total: await prisma.auditLog.count({ where: HISTORY_WHERE }),
      items: rows.map((h) => ({ action: h.action, entityLabel: h.entityLabel, actorEmail: h.actorEmail, createdAt: h.createdAt.toISOString() }))
    });
  } catch (err) { next(err); }
});

// "Save current data as a new file".
router.post("/backup/snapshot", express.json(), async (req, res, next) => {
  if (!requireConfirm(req, res)) return;
  try {
    const { meta, buffer } = await backup.createBackup({ createdBy: req.user.email });
    const file = backup.addFile(buffer, meta, { kind: "snapshot", addedBy: req.user.email });
    await audit.write(null, {
      actorEmail: req.user.email, action: "backupSnapshot", entityType: "system",
      entityLabel: displayLabel(file), after: { counts: meta.counts, schemaVersion: meta.schemaVersion }
    });
    res.json({ ok: true, id: file.id });
  } catch (err) { next(err); }
});

// Upload adds the file to the list only — nothing in the database changes
// until the admin chooses "use this file". The file is fully validated
// first, so a broken or foreign file never lands in the list.
router.post("/backup/upload", express.raw({ type: "application/octet-stream", limit: "200mb" }), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "empty" });
    let parsed;
    try {
      parsed = await backup.parseBackup(req.body);
    } catch (e) {
      if (e instanceof backup.BackupError) return res.status(400).json({ error: e.code, detail: e.detail });
      throw e;
    }
    const rawName = decodeURIComponent(String(req.get("X-File-Name") || "")).trim();
    const label = rawName.replace(/\.json\.gz$|\.gz$/i, "").slice(0, 120) || null;
    const file = backup.addFile(req.body, parsed.meta, { kind: "upload", label, addedBy: req.user.email });
    await audit.write(null, {
      actorEmail: req.user.email, action: "backupUpload", entityType: "system",
      entityLabel: displayLabel(file), after: { counts: parsed.meta.counts, schemaVersion: parsed.meta.schemaVersion }
    });
    res.json({ ok: true, id: file.id });
  } catch (err) { next(err); }
});

// "Use this file": replaces all current data with the file's.
router.post("/backup/files/:id/apply", express.json(), async (req, res, next) => {
  if (!requireConfirm(req, res)) return;
  const file = backup.getFile(req.params.id);
  if (!file) return res.status(404).json({ error: "notFound" });

  await withRestoreLock(res, next, async () => {
    // Parsed before the automatic backup is written — that write may prune
    // the oldest automatic file, which could be this very one.
    const parsed = await backup.parseBackup(fs.readFileSync(backup.filePath(file)));
    const label = displayLabel(file);
    const auto = await backup.saveAutoBackup({ createdBy: req.user.email, reason: "beforeApply", relatedId: file.id, relatedLabel: label });
    await backup.restoreBackup(parsed);
    backup.setActive({ id: file.id, label, at: new Date().toISOString() });
    // Written after the restore on purpose — the audit table itself was
    // just replaced, so logging earlier would be wiped along with it.
    await audit.write(null, {
      actorEmail: req.user.email, action: "backupRestore", entityType: "system", entityLabel: label,
      before: { autoBackup: auto.fileName, counts: auto.meta.counts },
      after: { counts: parsed.meta.counts, fileCreatedAt: parsed.meta.createdAt, fileCreatedBy: parsed.meta.createdBy }
    });
    res.json({ ok: true });
  });
});

// "Clear all data": empties every table so another file can be loaded
// into a blank system.
router.post("/backup/clear", express.json(), async (req, res, next) => {
  if (!req.body || req.body.confirm !== CLEAR_CONFIRM_PHRASE) return res.status(400).json({ error: "confirmPhrase" });

  await withRestoreLock(res, next, async () => {
    const auto = await backup.saveAutoBackup({ createdBy: req.user.email, reason: "beforeClear" });
    await backup.clearAll();
    backup.setActive({ cleared: true, at: new Date().toISOString() });
    await audit.write(null, {
      actorEmail: req.user.email, action: "backupClear", entityType: "system", entityLabel: "—",
      before: { autoBackup: auto.fileName, counts: auto.meta.counts }
    });
    res.json({ ok: true });
  });
});

// Removes a file from the list (and disk). The data in the system is not
// touched, even if it was loaded from this file.
router.delete("/backup/files/:id", async (req, res, next) => {
  try {
    const file = backup.getFile(req.params.id);
    if (!file) return res.status(404).json({ error: "notFound" });
    backup.deleteFile(file.id);
    await audit.write(null, {
      actorEmail: req.user.email, action: "backupDelete", entityType: "system", entityLabel: displayLabel(file)
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get("/backup/files/:id/download", (req, res) => {
  const file = backup.getFile(req.params.id);
  if (!file) return res.status(404).send("Not found");
  const downloadName = (file.label ? file.label.replace(/[\\/:*?"<>|]/g, "_") + ".json.gz" : file.fileName);
  res.download(backup.filePath(file), downloadName);
});

// ---- User manuals (PDF) shown on the login page — see src/manuals.js ----
router.get("/manuals", async (req, res, next) => {
  try {
    res.render("admin/manuals", { user: req.user, active: "adminManuals", manuals: await manuals.listInfo(), maxMb: manuals.MAX_BYTES / 1024 / 1024 });
  } catch (err) { next(err); }
});

// Body is the raw PDF; the original file name comes in X-File-Name
// (URI-encoded, since header values can't carry Thai characters as-is).
router.post("/manuals/:audience/:lang", express.raw({ type: "application/pdf", limit: manuals.MAX_BYTES }), async (req, res, next) => {
  try {
    let fileName = "";
    try { fileName = decodeURIComponent(String(req.get("X-File-Name") || "")); } catch (e) { /* keep default name */ }
    const result = await manuals.save(req.params.audience, req.params.lang, { buffer: req.body, fileName, actorEmail: req.user.email });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete("/manuals/:audience/:lang", async (req, res, next) => {
  try {
    const result = await manuals.remove(req.params.audience, req.params.lang, { actorEmail: req.user.email });
    if (result.error) return res.status(result.error === "notFound" ? 404 : 400).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// The old combined contact-info page was replaced by /admin/locations.
router.get("/contact-info", (req, res) => res.redirect("/admin/locations"));

module.exports = router;
