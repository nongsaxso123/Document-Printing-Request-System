/**
 * Whole-system backup & restore, for moving ODPRS to another server (or
 * rolling back) from the admin page at /admin/backup.
 *
 * Every piece of data this app keeps lives in Postgres — request-form PDFs
 * are rendered on demand (src/pdf.js), nothing is uploaded to disk — so one
 * file with every table is a complete copy. Only login sessions (the
 * connect-pg-simple "session" table) are left out: after a move everyone
 * just signs in again.
 *
 * File format: gzip'd JSON
 *   { meta: { app, formatVersion, createdAt, createdBy, schemaVersion,
 *             counts: { table: n }, checksum },
 *     data: { modelName: [ rows… ] } }
 * checksum is a sha256 of JSON.stringify(data), so a truncated or edited
 * file is rejected before anything is touched.
 *
 * Restore replaces everything (the admin chose "replace all" over merging:
 * merging would collide on reference numbers / RUN numbers / ids). It runs
 * in one transaction, so it either fully succeeds or leaves the database
 * exactly as it was; and a backup of the current data is written to
 * server/backups/ first regardless.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { Prisma } = require("@prisma/client");
const defaultPrisma = require("./prisma");
const { ensureDefaults } = require("./defaults");

const APP_ID = "odprs";
const FORMAT_VERSION = 1;
// Overridable so a deployment can keep backups outside the app folder.
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "../backups");
// Pre-restore safety backups kept on disk; older ones are deleted after each
// new one is written, so repeated restores can't slowly fill the disk.
const MAX_SAFETY_BACKUPS = 10;

// Parents before children — the order rows are inserted in. Deletion runs
// the same list backwards. Kept explicit (not derived) so a new model is a
// deliberate one-line addition here, never silently skipped: listModels()
// below refuses to run if the schema has a model this list doesn't cover.
const MODEL_ORDER = [
  "AgencyCategory",
  "AgencyUnit",
  "Location",
  "Officer",
  "Counter",
  "SystemSetting",
  "Profile",
  "Request",
  "Evaluation",
  "Notification",
  "AuditLog"
];

function delegateName(model) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function modelMeta() {
  const byName = {};
  Prisma.dmmf.datamodel.models.forEach((m) => { byName[m.name] = m; });
  const missing = Object.keys(byName).filter((n) => !MODEL_ORDER.includes(n));
  if (missing.length) throw new Error("backup.js MODEL_ORDER is missing model(s): " + missing.join(", "));
  return MODEL_ORDER.map((name) => {
    const m = byName[name];
    const scalar = m.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
    return {
      name,
      table: m.dbName || name,
      fieldNames: scalar.map((f) => f.name),
      jsonFields: scalar.filter((f) => f.type === "Json").map((f) => f.name),
      // Autoincrement ids need their Postgres sequence moved past the
      // restored rows, or the next insert would collide with id 1.
      serialId: scalar.some((f) => f.isId && f.default && f.default.name === "autoincrement"),
      orderBy: scalar.filter((f) => f.isId).map((f) => ({ [f.name]: "asc" }))
    };
  });
}

async function schemaVersion(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1"
  );
  return rows.length ? rows[0].migration_name : null;
}

async function appliedMigrations(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL"
  );
  return rows.map((r) => r.migration_name);
}

// How a file's schema version relates to this server's:
//   "same"  — made by this exact version
//   "older" — made before one or more migrations this server has since
//             applied; restorable, new columns/tables just get defaults
//   "newer" — made by a version this server doesn't know (newer code, or a
//             different branch); can't be restored until the server catches up
function compatibilityOf(fileVersion, currentVersion, applied) {
  if (fileVersion === currentVersion) return "same";
  if (fileVersion && applied.includes(fileVersion)) return "older";
  return "newer";
}

async function currentCounts(prisma = defaultPrisma) {
  const counts = {};
  for (const m of modelMeta()) counts[m.name] = await prisma[delegateName(m.name)].count();
  return counts;
}

function checksumOf(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

async function createBackup({ createdBy, prisma = defaultPrisma } = {}) {
  const data = {};
  const counts = {};
  for (const m of modelMeta()) {
    const rows = await prisma[delegateName(m.name)].findMany({ orderBy: m.orderBy.length ? m.orderBy : undefined });
    data[m.name] = rows;
    counts[m.name] = rows.length;
  }
  // Round-trip through JSON once so the checksum covers exactly what gets
  // written (Dates become ISO strings, etc.).
  const plainData = JSON.parse(JSON.stringify(data));
  const meta = {
    app: APP_ID,
    formatVersion: FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || null,
    schemaVersion: await schemaVersion(prisma),
    counts,
    checksum: checksumOf(plainData)
  };
  const buffer = zlib.gzipSync(Buffer.from(JSON.stringify({ meta, data: plainData }), "utf8"));
  return { meta, buffer };
}

function backupFileName(date = new Date(), prefix = "odprs-backup") {
  const pad = (n) => String(n).padStart(2, "0");
  return `${prefix}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.json.gz`;
}

class BackupError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail || null;
  }
}

// Parses and fully validates an uploaded file without touching the
// database. Throws BackupError with a code the page translates.
async function parseBackup(buffer, { prisma = defaultPrisma } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(zlib.gunzipSync(buffer).toString("utf8"));
  } catch (e) {
    throw new BackupError("unreadable");
  }
  if (!parsed || !parsed.meta || !parsed.data || parsed.meta.app !== APP_ID) throw new BackupError("notOdprs");
  if (parsed.meta.formatVersion !== FORMAT_VERSION) throw new BackupError("formatVersion", String(parsed.meta.formatVersion));
  if (checksumOf(parsed.data) !== parsed.meta.checksum) throw new BackupError("checksum");

  const compatibility = compatibilityOf(parsed.meta.schemaVersion, await schemaVersion(prisma), await appliedMigrations(prisma));
  if (compatibility === "newer") throw new BackupError("schemaNewer");

  for (const m of modelMeta()) {
    const rows = parsed.data[m.name];
    // A table added after an older file was made simply isn't in it.
    if (rows === undefined && compatibility === "older") continue;
    if (!Array.isArray(rows)) throw new BackupError("missingTable", m.name);
    if (rows.length !== (parsed.meta.counts || {})[m.name]) throw new BackupError("checksum");
  }
  parsed.compatibility = compatibility;
  return parsed;
}

function toCreateRow(row, jsonFields) {
  if (!jsonFields.length) return row;
  const out = Object.assign({}, row);
  // Prisma won't take a bare null for a Json column — it has to be told
  // explicitly whether that means SQL NULL (what an empty field was).
  jsonFields.forEach((f) => { if (out[f] === null || out[f] === undefined) out[f] = Prisma.DbNull; });
  return out;
}

const INSERT_CHUNK = 1000;

// Keeps only the columns this schema still has — an older file can carry
// fields a later migration dropped.
function pickFields(row, fieldNames) {
  const out = {};
  fieldNames.forEach((f) => { if (row[f] !== undefined) out[f] = row[f]; });
  return out;
}

async function deleteAll(tx, models) {
  for (const m of models.slice().reverse()) {
    await tx[delegateName(m.name)].deleteMany({});
  }
}

async function restoreBackup(parsed, { prisma = defaultPrisma } = {}) {
  const models = modelMeta();
  const older = parsed.compatibility === "older";
  try {
    await prisma.$transaction(async (tx) => {
      await deleteAll(tx, models);
      for (const m of models) {
        const rows = parsed.data[m.name] || [];
        for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
          const chunk = rows.slice(i, i + INSERT_CHUNK).map((r) => toCreateRow(older ? pickFields(r, m.fieldNames) : r, m.jsonFields));
          await tx[delegateName(m.name)].createMany({ data: chunk });
        }
        if (m.serialId) {
          await tx.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('"${m.table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${m.table}"), 1), (SELECT MAX(id) FROM "${m.table}") IS NOT NULL)`
          );
        }
      }
      // A file with no agencies/locations/settings (e.g. one made before
      // those tables existed) would leave the system unable to take
      // requests — fill just those empty tables with the factory defaults.
      await ensureDefaults(tx);
    }, { timeout: 10 * 60 * 1000, maxWait: 30 * 1000 });
  } catch (e) {
    // An older file whose rows can't satisfy the current schema (e.g. a
    // later migration added a required column with no default). The
    // transaction rolled back, so the current data is untouched.
    if (older) throw new BackupError("incompatible");
    throw e;
  }
}

// "Clear all data": every table emptied, then agencies, locations and
// settings put back to their factory defaults (src/defaults.js) so the
// system can take requests straight away — all in one transaction. Login
// sessions aren't a Prisma model, so whoever is signed in stays signed in.
async function clearAll({ prisma = defaultPrisma } = {}) {
  const models = modelMeta();
  await prisma.$transaction(async (tx) => {
    await deleteAll(tx, models);
    await ensureDefaults(tx);
  }, { timeout: 10 * 60 * 1000, maxWait: 30 * 1000 });
}

/* ---------------------------------------------------------------------
   File library — every backup file the admin can pick from, kept in
   BACKUP_DIR with a small index (library.json) holding each file's
   label/kind/meta plus which file the current data was last loaded from:
     { active: { id, label, at } | { cleared: true, at } | null,
       files: [ { id, fileName, kind, label, reason, relatedId, relatedLabel,
                  addedAt, addedBy, size, meta } ] }
   kind: "upload"   — a file the admin uploaded (label = its file name)
         "snapshot" — "save current data as a new file"
         "auto"     — written automatically before "use this file" or
                      "clear all data" (reason: "beforeApply" / "beforeClear"),
                      only the latest MAX_SAFETY_BACKUPS are kept
   --------------------------------------------------------------------- */
const LIBRARY_FILE = path.join(BACKUP_DIR, "library.json");

function readMeta(buffer) {
  const parsed = JSON.parse(zlib.gunzipSync(buffer).toString("utf8"));
  const { createdAt, createdBy, schemaVersion: version, counts } = parsed.meta || {};
  return { createdAt, createdBy, schemaVersion: version, counts };
}

// First run: adopt the files earlier versions of this page left in
// BACKUP_DIR, so nothing already there goes missing from the list.
function adoptExistingFiles() {
  const files = [];
  if (!fs.existsSync(BACKUP_DIR)) return files;
  fs.readdirSync(BACKUP_DIR).filter((n) => /\.json\.gz$/.test(n)).sort().forEach((fileName) => {
    const full = path.join(BACKUP_DIR, fileName);
    let meta;
    try { meta = readMeta(fs.readFileSync(full)); } catch (e) { return; }
    const auto = /^odprs-before-restore-/.test(fileName);
    files.push({
      id: crypto.randomBytes(8).toString("hex"),
      fileName,
      kind: auto ? "auto" : "snapshot",
      label: null,
      reason: auto ? "beforeApply" : null,
      relatedId: null,
      relatedLabel: null,
      addedAt: meta.createdAt || fs.statSync(full).mtime.toISOString(),
      addedBy: meta.createdBy || null,
      size: fs.statSync(full).size,
      meta
    });
  });
  return files;
}

function readLibrary() {
  if (fs.existsSync(LIBRARY_FILE)) return JSON.parse(fs.readFileSync(LIBRARY_FILE, "utf8"));
  const lib = { active: null, files: adoptExistingFiles() };
  writeLibrary(lib);
  return lib;
}

function writeLibrary(lib) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const tmp = LIBRARY_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(lib, null, 2));
  fs.renameSync(tmp, LIBRARY_FILE);
}

function addFile(buffer, meta, { kind, label = null, reason = null, relatedId = null, relatedLabel = null, addedBy = null }) {
  const lib = readLibrary();
  const id = crypto.randomBytes(8).toString("hex");
  const fileName = backupFileName(new Date(), "odprs-" + kind).replace(".json.gz", "-" + id + ".json.gz");
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(path.join(BACKUP_DIR, fileName), buffer);
  const { createdAt, createdBy, schemaVersion: version, counts } = meta;
  const entry = {
    id, fileName, kind, label, reason, relatedId, relatedLabel,
    addedAt: new Date().toISOString(), addedBy, size: buffer.length,
    meta: { createdAt, createdBy, schemaVersion: version, counts }
  };
  lib.files.push(entry);
  // Automatic files are capped so repeated use can't slowly fill the disk;
  // uploads and snapshots stay until the admin deletes them.
  const autos = lib.files.filter((f) => f.kind === "auto").sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  autos.slice(MAX_SAFETY_BACKUPS).forEach((old) => {
    try { fs.unlinkSync(path.join(BACKUP_DIR, old.fileName)); } catch (e) { /* already gone */ }
    lib.files = lib.files.filter((f) => f.id !== old.id);
  });
  writeLibrary(lib);
  return entry;
}

function getFile(id) {
  return readLibrary().files.find((f) => f.id === id) || null;
}

function filePath(entry) {
  return path.join(BACKUP_DIR, entry.fileName);
}

function deleteFile(id) {
  const lib = readLibrary();
  const entry = lib.files.find((f) => f.id === id);
  if (!entry) return false;
  try { fs.unlinkSync(filePath(entry)); } catch (e) { /* already gone */ }
  lib.files = lib.files.filter((f) => f.id !== id);
  writeLibrary(lib);
  return true;
}

function setActive(active) {
  const lib = readLibrary();
  lib.active = active;
  writeLibrary(lib);
}

// Newest first, each tagged with whether it can be loaded into this server.
async function listFiles({ prisma = defaultPrisma } = {}) {
  const lib = readLibrary();
  const current = await schemaVersion(prisma);
  const applied = await appliedMigrations(prisma);
  const files = lib.files
    .slice()
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .map((f) => Object.assign({}, f, { compatibility: compatibilityOf(f.meta.schemaVersion, current, applied) }));
  return { active: lib.active, files };
}

// Written before every "use this file" / "clear all data" — so either can
// be undone by using this file.
async function saveAutoBackup({ createdBy, reason, relatedId = null, relatedLabel = null, prisma = defaultPrisma } = {}) {
  const { meta, buffer } = await createBackup({ createdBy, prisma });
  return addFile(buffer, meta, { kind: "auto", reason, relatedId, relatedLabel, addedBy: createdBy });
}

module.exports = {
  createBackup,
  parseBackup,
  readMeta,
  restoreBackup,
  clearAll,
  saveAutoBackup,
  addFile,
  getFile,
  filePath,
  deleteFile,
  setActive,
  listFiles,
  currentCounts,
  currentSchemaVersion: (prisma = defaultPrisma) => schemaVersion(prisma),
  backupFileName,
  BackupError,
  MODEL_ORDER,
  MAX_SAFETY_BACKUPS
};
