const crypto = require("crypto");
const { Prisma } = require("@prisma/client");
/**
 * Request queries + the DB-shape -> client-shape JSON mapper.
 * Client-side (server/views/officer/*.ejs inline scripts, ported almost
 * verbatim from prototype/officer/*.html) still expects the same field
 * names/status codes the old mock store used, so all mapping lives here
 * rather than touching every page's rendering logic.
 */

const prisma = require("./prisma");
const counters = require("./counters");
const businessDays = require("./businessDays");
const notifications = require("./notifications");
const locations = require("./locations");
const unitDirectory = require("./units");
const evaluationForm = require("./evaluationForm");

// v0.4 print-spec fields: the new-request.ejs form submits short codes
// (client-side JS branches on these), but every display page (translateValue
// in app.js) works by matching the canonical Thai label text already used
// throughout this codebase for stored option values (paperSize, old
// printOption, etc.) — so incoming codes are mapped to that same canonical
// Thai text here, once, at the write boundary.
const COLOR_MODE_TH = { bw: "ขาวดำ", color: "สี" };
const PRINT_SIDE_TH = { single: "พิมพ์หน้าเดียว", double: "พิมพ์สองหน้า" };
// v0.6: Finishing/Binding is multi-select again — the Registrar Division
// counter's own stakeholder confirmed several finishing techniques really
// can be combined by hand (see schema.prisma's finishingMethods comment).
// No "none" code: an empty array means no finishing, nothing special to map.
const FINISHING_METHOD_TH = {
  corner: "เย็บมุม",
  side: "เย็บข้าง",
  hole: "เจาะรู",
  saddleStitch: "เย็บมุงหลังคา (Saddle-stitch)",
  coil: "เข้าเล่มห่วงสัน (Coil)",
  clothTape: "เข้าเล่มเทปผ้า",
  glue: "เข้าเล่มสันกาว"
};
const DOCUMENT_TYPE_TH = { exam: "ข้อสอบ", general: "เอกสารทั่วไป" };

// Longest "items to print" text that still keeps the printed Request Form on
// one A4 page (measured 2026-11-13: ~150-170 chars spill onto a 2nd page).
// Same number as maxlength on the textarea in requester/new-request.ejs.
const ITEM_LIST_MAX = 120;

// Exam print jobs at the counter only ever get a quick corner-staple (or
// nothing) — none of the book-binding methods are offered for exams in
// the real process, regardless of what the client sends.
const EXAM_ALLOWED_FINISHING = new Set(["corner"]);

// Groups where at most ONE member may be selected together — true
// regardless of who finishes the job by hand, so these don't need
// stakeholder confirmation: Corner vs. Side staple is a choice of
// position, not both at once, and the four true Binding methods
// (Saddle-stitch/Coil/Cloth Tape/Glue) each define a mutually exclusive
// final bound state of the whole document. Every other combination (e.g.
// staple + hole punch, staple + a Binding method) is left allowed for now
// pending the Registrar Division confirming the rest — see file.md
// Appendix B.
const EXCLUSIVE_FINISHING_GROUPS = [
  ["corner", "side"],
  ["saddleStitch", "coil", "clothTape", "glue"]
];

// Assumed physical limits of the counter's stapler/binding equipment,
// keyed by finishing code and checked against Original_Pages (the page
// count of one physical set — each copy is finished separately, so
// copies don't multiply the constraint). These numbers are generic
// office copy-shop figures, NOT yet confirmed against the Registrar
// Division's actual equipment — see file.md Appendix B. Kept in this one
// object so the real numbers are a single edit once known.
const FINISHING_PAGE_LIMITS = {
  // Saddle-stitch folds the sheet stack in half and staples through the
  // spine: the fold only lies flat up to ~60 pages, and each physical
  // sheet folds into 4 booklet pages, so the count must be a multiple of 4.
  saddleStitch: { min: 4, max: 60, multipleOf: 4 },
  // A perfect/glue-bound spine needs enough page thickness for the glue to
  // grip; a handful of sheets has no real spine to bind.
  glue: { min: 20 },
  // A standard stapler can't drive a staple through more than ~80 sheets.
  corner: { max: 80 }
};
const PAPER_SOURCE_TH = { office: "ฝ่ายทะเบียนจัดเตรียมให้", requester: "ผู้ขอจัดเตรียมเอง" };

// Copy Label's auto-run numbers are zero-padded to 3 digits (001..999) —
// capping copies here keeps that format from overflowing to 4 digits.
const MAX_COPIES = 999;

const STATUS_TO_CODE = {
  AWAITING_ORIGINAL_DOCUMENT: "awaiting",
  REJECTED: "rejected",
  PRINTING_IN_PROGRESS: "printing",
  READY_FOR_PICKUP: "ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
};

const CODE_TO_STATUS = Object.fromEntries(Object.entries(STATUS_TO_CODE).map(([k, v]) => [v, k]));

// @db.Date columns come back as UTC-midnight JS Dates; using local getters
// here would shift the date by a day in timezones behind UTC.
function toDateInputValue(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isFinished(r) {
  return locations.FINISHED_STATUSES.includes(r.status);
}

// Which version of a place a request shows — see the comment in toClientJSON.
function locationFor(r, live, snapshot) {
  const finished = isFinished(r);
  if (finished && snapshot) return snapshot;
  if (live) return locations.snapshotOf(live);
  return snapshot || null;
}

function toClientJSON(r) {
  return {
    referenceNo: r.requestReferenceNo,
    runNumber: r.runNumber,
    requesterName: r.requesterName,
    requesterEmail: r.requesterEmail,
    tel: r.requesterTel,
    unitType: r.unitType,
    unit: r.unit,
    unitTypeId: r.unitTypeId,
    unitId: r.unitId,
    // Live English name when the caller included the relation (getByRef),
    // else null (print form / detail views fall back to UNIT_TYPE_EN's
    // static copy, then the stored Thai name). A finished request only takes
    // it while the category still has the Thai name it was submitted under —
    // after a rename it keeps showing what was saved, like locationFor().
    unitTypeNameEn: r.unitTypeRef && (!isFinished(r) || r.unitTypeRef.nameTh === r.unitType)
      ? r.unitTypeRef.nameEn : null,
    paperSize: r.paperSize,
    colorMode: r.colorMode,
    printSide: r.printSide,
    finishing: r.finishingMethods,
    documentType: r.documentType,
    paperSource: r.paperSource,
    copyLabelEnabled: r.copyLabelEnabled,
    copyLabelMode: r.copyLabelMode,
    copyLabelPrefix: r.copyLabelPrefix,
    copyLabelStart: r.copyLabelStart,
    copyLabelManual: r.copyLabelManual,
    itemList: r.itemList,
    originalPages: r.originalPages,
    copies: r.numberOfCopies,
    submissionDate: r.submissionDate.toISOString(),
    dropoffDeadlineDate: r.originalDocDeadline.toISOString(),
    originalDocReceivedTimestamp: r.originalDocReceivedTimestamp ? r.originalDocReceivedTimestamp.toISOString() : null,
    completionDateProposed: toDateInputValue(r.appointmentDateProposed),
    completionDateConfirmed: r.appointmentDateConfirmed ? toDateInputValue(r.appointmentDateConfirmed) : null,
    claimCode: r.claimCode,
    statusCode: STATUS_TO_CODE[r.status],
    rejectionReason: r.rejectionReason,
    rejectedAt: r.rejectedAt ? r.rejectedAt.toISOString() : null,
    cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
    readyAt: r.readyAt ? r.readyAt.toISOString() : null,
    markedReadyByOfficer: r.markedReadyByOfficerName,
    reviewedByOfficer: r.reviewedByOfficerName,
    reviewedByOfficerEmail: r.reviewedByOfficerEmail,
    handedOverByOfficer: r.handedOverByOfficerName,
    handedOverByOfficerEmail: r.handedOverByOfficerEmail,
    receiverName: r.receiverName,
    receiverPosition: r.receiverPosition,
    receiverWorkplace: r.receiverWorkplace,
    receiverWorkPhone: r.receiverWorkPhone,
    completedTimestamp: r.completedTimestamp ? r.completedTimestamp.toISOString() : null,
    // Open requests follow the live Location row (getByRef includes it) so a
    // rename or new phone number reaches people who still have to go there.
    // Finished requests (completed / rejected / cancelled) show the snapshot —
    // the place as it was — and that is also what lets a place be deleted
    // once only finished requests point at it (locations.remove()).
    dropoffLocation: locationFor(r, r.dropoffLocation, r.dropoffLocationSnapshot),
    pickupLocation: locationFor(r, r.pickupLocation, r.pickupLocationSnapshot),
    pickupAvailableFrom: r.pickupAvailableFrom ? r.pickupAvailableFrom.toISOString() : null
  };
}

async function getByRef(ref) {
  const row = await prisma.request.findUnique({
    where: { requestReferenceNo: ref },
    include: { dropoffLocation: true, pickupLocation: true, unitTypeRef: true }
  });
  return row ? toClientJSON(row) : null;
}

// Counter Handover's only use of a claim code is looking up the one request
// currently waiting for pickup — scoping to READY_FOR_PICKUP here (rather
// than an unordered findFirst across all statuses) matters because claim
// codes are a random 6-digit value with no uniqueness check at generation
// (see approve()'s history before the collision fix), so the same code can
// legitimately exist on an unrelated older/completed request; without this
// scope, findFirst could return that other row instead and the counter
// would wrongly report "not found" even though the real match exists.
async function getByClaimCode(code) {
  const row = await prisma.request.findFirst({
    where: { claimCode: code, status: "READY_FOR_PICKUP" },
    include: { pickupLocation: true }
  });
  return row ? toClientJSON(row) : null;
}

async function listByRequester(requesterEmail) {
  const rows = await prisma.request.findMany({
    where: { requesterEmail },
    orderBy: { submissionDate: "desc" }
  });
  return rows.map(toClientJSON);
}

// officer/queue.ejs only ever needs this small, naturally-bounded slice —
// filtering server-side instead of fetching every request (GET /api/requests)
// and filtering in the browser, which visibly slowed down once the table
// grew into the tens of thousands of rows.
async function listAwaiting() {
  const rows = await prisma.request.findMany({
    where: { status: "AWAITING_ORIGINAL_DOCUMENT" },
    orderBy: { submissionDate: "asc" }
  });
  return rows.map(toClientJSON);
}

// officer/printing-jobs.ejs — same rationale as listAwaiting() above.
async function listPrinting() {
  const rows = await prisma.request.findMany({
    where: { status: "PRINTING_IN_PROGRESS" },
    orderBy: { originalDocReceivedTimestamp: "asc" }
  });
  return rows.map(toClientJSON);
}

// Single narrow-column scan (just submissionDate) — used to populate the
// history page's year filter, and internally by searchHistory() for a
// month-only filter (see below). Much cheaper than fetching full rows.
async function listAvailableYears() {
  const rows = await prisma.request.findMany({ select: { submissionDate: true } });
  return Array.from(new Set(rows.map((r) => r.submissionDate.getFullYear()))).sort((a, b) => b - a);
}

// officer/history.ejs search/filter/pagination, computed server-side —
// same rationale as listAwaiting() above: the old GET /api/requests + browser
// JS filter/paginate approach shipped every row over the network on every
// page load, which doesn't scale.
// Shared by searchHistory (one page for the table) and the Excel export in
// src/reports.js (every matching row), so the export always matches exactly
// what the filters on screen show.
async function buildHistoryWhere({ status, unitType, year, month, q, fromDate, toDate } = {}) {
  const andClauses = [];
  if (status && CODE_TO_STATUS[status]) andClauses.push({ status: CODE_TO_STATUS[status] });
  if (unitType) andClauses.push({ unitType });

  const hasCustomRange = !!(fromDate || toDate);
  const hasYear = year !== undefined && year !== null && year !== "";
  const hasMonth = month !== undefined && month !== null && month !== "";
  if (hasCustomRange) {
    const range = {};
    if (fromDate) range.gte = parseDateOnly(fromDate);
    if (toDate) {
      const to = parseDateOnly(toDate);
      to.setDate(to.getDate() + 1); // toDate itself is inclusive
      range.lt = to;
    }
    andClauses.push({ submissionDate: range });
  } else if (hasYear && hasMonth) {
    const y = Number(year), m = Number(month);
    andClauses.push({ submissionDate: { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) } });
  } else if (hasYear) {
    const y = Number(year);
    andClauses.push({ submissionDate: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } });
  } else if (hasMonth) {
    // No year given — match this calendar month across every year that has any data.
    const m = Number(month);
    const years = await listAvailableYears();
    andClauses.push({
      OR: years.map((y) => ({ submissionDate: { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) } }))
    });
  }

  if (q) {
    const contains = { contains: q, mode: "insensitive" };
    andClauses.push({
      OR: [
        { requestReferenceNo: contains },
        { runNumber: contains },
        { requesterName: contains },
        { receiverName: contains },
        { claimCode: contains },
        { reviewedByOfficerName: contains },
        { handedOverByOfficerName: contains }
      ]
    });
  }

  return andClauses.length > 0 ? { AND: andClauses } : {};
}

async function searchHistory({ status, unitType, year, month, q, page, pageSize, fromDate, toDate } = {}) {
  const where = await buildHistoryWhere({ status, unitType, year, month, q, fromDate, toDate });
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));

  const [total, rows] = await Promise.all([
    prisma.request.count({ where }),
    prisma.request.findMany({
      where,
      orderBy: { submissionDate: "desc" },
      skip: (pageNum - 1) * size,
      take: size
    })
  ]);

  return { records: rows.map(toClientJSON), total, page: pageNum, pageSize: size };
}

// Statuses that mean paper was actually consumed (mirrors PRINTED_STATUSES
// in officer/dashboard.ejs, but against the raw DB enum, not the client's
// translated status codes).
const PRINTED_STATUS_ENUMS = ["PRINTING_IN_PROGRESS", "READY_FOR_PICKUP", "COMPLETED"];

const DASHBOARD_SELECT = {
  unitType: true,
  unitTypeId: true,
  unit: true,
  unitId: true,
  originalPages: true,
  numberOfCopies: true,
  printSide: true,
  status: true,
  submissionDate: true
};

// Real physical paper sheets, not printed pages — double-sided halves the
// sheet count per page (matches the Total Sheets calc on the request form,
// FR-17, and the identical client-side helper this replaces in dashboard.ejs).
function computeSheets(r) {
  const pages = Number(r.originalPages || 0);
  const copies = Number(r.numberOfCopies || 0);
  if (r.printSide === PRINT_SIDE_TH.double) return Math.ceil(pages / 2) * copies;
  return pages * copies;
}

// Parses a plain "YYYY-MM-DD" (from an <input type="date">) as a *local*
// midnight Date, matching how submissionDate (a full DateTime, not @db.Date)
// is already bucketed elsewhere in this function via `new Date(y, 0, 1)` —
// unlike the @db.Date columns elsewhere in this codebase, this one is not
// UTC-midnight-normalized, so a "Z" suffix here would shift it by a day.
function parseDateOnly(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Dashboard aggregation, computed server-side so the browser never has to
// download/process every raw request row — the naive version of this
// (GET /api/requests + summing in browser JS) visibly slows down once the
// table has tens of thousands of rows. Two mutually-exclusive time-scoping
// modes, matching the UI's toggle: `year` (+ optional `month`, same
// year/month combination logic as searchHistory/searchEvaluations — either
// alone, together, or month-alone matching that calendar month across every
// year with data) as the default calendar mode, or `fromDate`/`toDate`
// (either or both) for an arbitrary custom range when the officer explicitly
// wants day-level precision. The custom range takes priority if both are
// somehow present.
// ---- Officer dashboard (officer/dashboard.ejs) ----
// submission_date is stored in UTC; years/days are counted in local time.
const DASH_TZ = process.env.TZ || "Asia/Bangkok";
const SHEETS_SQL = Prisma.sql`CASE WHEN print_side = ${PRINT_SIDE_TH.double} THEN CEIL(original_pages / 2.0) * number_of_copies ELSE original_pages * number_of_copies END`;
const LOCAL_TS_SQL = Prisma.sql`((submission_date AT TIME ZONE 'UTC') AT TIME ZONE ${DASH_TZ})`;

function dashboardWhere({ unitType, unit, documentType, paperSource } = {}) {
  const where = { status: { in: PRINTED_STATUS_ENUMS } };
  if (unitType) where.unitType = unitType;
  if (unit) where.unit = unit;
  if (documentType) where.documentType = documentType;
  if (paperSource) where.paperSource = paperSource;
  return where;
}

// Filter choices (types, units, document types, paper sources) seen in
// printed requests. Small; cached briefly.
let dashboardOptionsCache = null;
async function dashboardOptions() {
  if (dashboardOptionsCache && Date.now() - dashboardOptionsCache.at < 60 * 1000) return dashboardOptionsCache.data;
  const where = { status: { in: PRINTED_STATUS_ENUMS } };
  const [reqPairs, docs, srcs, typeRows, unitRows, firstRow] = await Promise.all([
    prisma.request.groupBy({ by: ["unitType", "unit"], where }),
    prisma.request.groupBy({ by: ["documentType"], where }),
    prisma.request.groupBy({ by: ["paperSource"], where }),
    prisma.unitType.findMany({ select: { nameTh: true, nameEn: true, sortOrder: true } }),
    // every unit from the admin tables too, so a unit with no printing yet
    // can still be picked (stored on requests as "<th> (<en>)")
    prisma.unit.findMany({ where: { isActive: true }, select: { nameTh: true, nameEn: true, category: { select: { nameTh: true } } } }),
    prisma.$queryRaw`SELECT MIN(EXTRACT(YEAR FROM ${LOCAL_TS_SQL}))::int AS y FROM requests WHERE status::text IN (${Prisma.join(PRINTED_STATUS_ENUMS)})`
  ]);
  const seen = new Set();
  const pairs = reqPairs.concat(unitRows.map((u) => ({ unitType: u.category.nameTh, unit: `${u.nameTh} (${u.nameEn})` })))
    .filter((p) => { const k = p.unitType + "\u0001" + p.unit; if (!p.unit || seen.has(k)) return false; seen.add(k); return true; });
  const order = new Map(typeRows.map((x) => [x.nameTh, x.sortOrder]));
  const enOf = new Map(typeRows.map((x) => [x.nameTh, x.nameEn]));
  const types = Array.from(new Set(pairs.map((p) => p.unitType))).filter(Boolean)
    .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b, "th"));
  const data = {
    types: types.map((th) => ({ th, en: enOf.get(th) || th })),
    // stored unit strings read "<th> (<en>)"; the page splits them per language
    units: pairs.filter((p) => p.unit).map((p) => ({ type: p.unitType, unit: p.unit })).sort((a, b) => a.unit.localeCompare(b.unit, "th")),
    docs: docs.map((d) => d.documentType).filter(Boolean),
    srcs: srcs.map((d) => d.paperSource).filter(Boolean),
    firstYear: firstRow[0] && firstRow[0].y ? Number(firstRow[0].y) : null,
    today: localToday()
  };
  dashboardOptionsCache = { at: Date.now(), data };
  return data;
}

// ---- Officer dashboard: one period at a time ----
// The page picks a period (everything, a year, a month or any from-to
// dates) plus unit / document filters; everything is counted here so the
// browser gets a small answer whatever the size of the table.
// Days are local days (DASH_TZ), written "YYYY-MM-DD".
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function localToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DASH_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
// "YYYY-MM-DD" helpers on plain strings (no time zone involved)
const dayParts = (s) => s.split("-").map(Number);
const dayStr = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function addDays(s, n) {
  const [y, m, d] = dayParts(s);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return dayStr(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
function minusYear(s) {
  const [y, m, d] = dayParts(s);
  const last = new Date(Date.UTC(y - 1, m, 0)).getUTCDate(); // 29 Feb -> 28 Feb
  return dayStr(y - 1, m, Math.min(d, last));
}
const daysBetween = (a, b) => Math.round((Date.UTC(...dayParts(b).map((v, i) => (i === 1 ? v - 1 : v))) - Date.UTC(...dayParts(a).map((v, i) => (i === 1 ? v - 1 : v)))) / 864e5);

function rangeConds(params, from, to, withUnit) {
  const conds = [Prisma.sql`status::text IN (${Prisma.join(PRINTED_STATUS_ENUMS)})`];
  if (params.unitType) conds.push(Prisma.sql`unit_type = ${params.unitType}`);
  if (withUnit && params.unit) conds.push(Prisma.sql`unit = ${params.unit}`);
  if (params.documentType) conds.push(Prisma.sql`document_type = ${params.documentType}`);
  if (params.paperSource) conds.push(Prisma.sql`paper_source = ${params.paperSource}`);
  if (from) conds.push(Prisma.sql`(${LOCAL_TS_SQL})::date >= ${from}::date`);
  if (to) conds.push(Prisma.sql`(${LOCAL_TS_SQL})::date <= ${to}::date`);
  return Prisma.join(conds, " AND ");
}

// Every unit in the period (unit filter left out so the table can rank the
// chosen unit among the others), split by document type and paper source.
function unitRows(params, from, to) {
  return prisma.$queryRaw`
    SELECT unit_type AS type, unit, document_type AS doc, paper_source AS src,
           COUNT(*)::int AS requests, COALESCE(SUM(${SHEETS_SQL}), 0)::bigint AS sheets
    FROM requests WHERE ${rangeConds(params, from, to, false)} GROUP BY 1, 2, 3, 4`;
}

// params: { from?, to?, unitType?, unit?, documentType?, paperSource? }
// {
//   from, to, today, upTo,            upTo = last day counted (today when the period runs past it)
//   bucket: "day" | "month" | "year",
//   prev: { from, to } | null,         same days one year earlier (null for "everything")
//   totals: { requests, sheets, units }, prevTotals: {...} | null,
//   series: [{ k: "YYYY-MM-DD", sheets, requests, prev }],   one per bucket; sheets null after today
//   units: [{ type, unit, requests, sheets, prev }],          most sheets first
//   rank: { pos, total } | null,                              when one unit is chosen
//   types: [{ type, sheets }], docs: [{ value, sheets }], srcs: [{ value, sheets }]
// }
async function dashboardRange(params = {}) {
  const today = localToday();
  let from = DAY_RE.test(params.from || "") ? params.from : null;
  let to = DAY_RE.test(params.to || "") ? params.to : null;
  if (from && to && from > to) [from, to] = [to, from];

  // "everything": from the first printed day
  if (!from) {
    const first = await prisma.$queryRaw`
      SELECT to_char(MIN((${LOCAL_TS_SQL})::date), 'YYYY-MM-DD') AS d FROM requests WHERE ${rangeConds({}, null, null, false)}`;
    from = (first[0] && first[0].d) || today;
  }
  const allTime = !params.from;
  if (!to) to = allTime ? today : from;
  const upTo = to > today ? today : to;
  const prev = allTime || upTo < from ? null : { from: minusYear(from), to: minusYear(upTo) };

  const span = daysBetween(from, to);
  const bucket = allTime ? "year" : span <= 62 ? "day" : span <= 1100 ? "month" : "year";
  const trunc = Prisma.raw(`'${bucket}'`);
  const seriesSql = (a, b) => prisma.$queryRaw`
    SELECT to_char(date_trunc(${trunc}, (${LOCAL_TS_SQL})::date), 'YYYY-MM-DD') AS k,
           COUNT(*)::int AS requests, COALESCE(SUM(${SHEETS_SQL}), 0)::bigint AS sheets
    FROM requests WHERE ${rangeConds(params, a, b, true)} GROUP BY 1`;

  const [rows, prevRows, series, prevSeries] = await Promise.all([
    unitRows(params, from, upTo),
    prev ? unitRows(params, prev.from, prev.to) : [],
    seriesSql(from, upTo),
    prev ? seriesSql(prev.from, prev.to) : []
  ]);

  const units = new Map(), types = new Map(), docs = new Map(), srcs = new Map();
  // per type / document type / paper source: requests, sheets, units, and last year
  const breakdown = { types: new Map(), docs: new Map(), srcs: new Map() };
  const totals = { requests: 0, sheets: 0, units: 0 };
  for (const r of rows) {
    const sh = Number(r.sheets), rq = Number(r.requests);
    const u = units.get(r.unit) || { type: r.type, unit: r.unit, requests: 0, sheets: 0, prev: 0 };
    u.requests += rq; u.sheets += sh; units.set(r.unit, u);
    if (params.unit && r.unit !== params.unit) continue;
    totals.requests += rq; totals.sheets += sh;
    types.set(r.type, (types.get(r.type) || 0) + sh);
    if (r.doc) docs.set(r.doc, (docs.get(r.doc) || 0) + sh);
    if (r.src) srcs.set(r.src, (srcs.get(r.src) || 0) + sh);
    for (const [dim, key] of [["types", r.type], ["docs", r.doc], ["srcs", r.src]]) {
      if (!key) continue;
      const b = breakdown[dim].get(key) || { key, requests: 0, sheets: 0, prev: 0, prevRequests: 0, units: new Set() };
      b.requests += rq; b.sheets += sh; b.units.add(r.unit); breakdown[dim].set(key, b);
    }
  }
  let prevTotals = null;
  if (prev) {
    prevTotals = { requests: 0, sheets: 0, units: 0 };
    const seen = new Set();
    for (const r of prevRows) {
      const sh = Number(r.sheets);
      const u = units.get(r.unit);
      if (u) u.prev += sh;
      if (params.unit && r.unit !== params.unit) continue;
      prevTotals.requests += Number(r.requests); prevTotals.sheets += sh; seen.add(r.unit);
      for (const [dim, key] of [["types", r.type], ["docs", r.doc], ["srcs", r.src]]) {
        if (!key) continue;
        const b = breakdown[dim].get(key) || { key, requests: 0, sheets: 0, prev: 0, prevRequests: 0, units: new Set() };
        b.prev += sh; b.prevRequests += Number(r.requests); breakdown[dim].set(key, b);
      }
    }
    prevTotals.units = seen.size;
  }
  const unitList = Array.from(units.values()).sort((a, b) => b.sheets - a.sheets);
  totals.units = params.unit ? (units.has(params.unit) ? 1 : 0) : unitList.length;
  let rank = null;
  if (params.unit) {
    const i = unitList.findIndex((u) => u.unit === params.unit && u.sheets > 0);
    rank = { pos: i < 0 ? null : i + 1, total: unitList.filter((u) => u.sheets > 0).length };
  }

  // one entry per bucket from `from` to `to`, gaps as 0, after today null
  const keyOf = (s) => (bucket === "day" ? s : bucket === "month" ? s.slice(0, 8) + "01" : s.slice(0, 5) + "01-01");
  const step = (s) => {
    const [y, m] = dayParts(s);
    return bucket === "day" ? addDays(s, 1) : bucket === "month" ? dayStr(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) : dayStr(y + 1, 1, 1);
  };
  const cur = new Map(series.map((r) => [r.k, r]));
  const old = new Map(prevSeries.map((r) => [keyOf(addYears(r.k, 1)), Number(r.sheets)]));
  const out = [];
  for (let k = keyOf(from), n = 0; k <= to && n < 400; k = step(k), n++) {
    const r = cur.get(k);
    const future = k > upTo;
    out.push({ k, sheets: future ? null : r ? Number(r.sheets) : 0, requests: future ? null : r ? r.requests : 0, prev: prev && !future ? old.get(k) || 0 : null });
  }

  const list = (m, name) => Array.from(m, ([value, sheets]) => ({ [name]: value, sheets })).sort((a, b) => b.sheets - a.sheets);
  const detail = (m) => Array.from(m.values()).map((b) => ({ ...b, units: b.units.size })).sort((a, b) => b.sheets - a.sheets);

  // Excel export only: sheets per unit per bucket, and every printed request
  let matrix = null, requestRows = null;
  if (params.withDetail) {
    [matrix, requestRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT unit_type AS type, unit, to_char(date_trunc(${trunc}, (${LOCAL_TS_SQL})::date), 'YYYY-MM-DD') AS k,
               COUNT(*)::int AS requests, COALESCE(SUM(${SHEETS_SQL}), 0)::bigint AS sheets
        FROM requests WHERE ${rangeConds(params, from, upTo, true)} GROUP BY 1, 2, 3`,
      prisma.$queryRaw`
        SELECT request_reference_no AS ref, run_number AS run, submission_date AS submitted, status::text AS status,
               requester_name AS name, unit_type AS type, unit, document_type AS doc, paper_source AS src,
               paper_size AS "paperSize", color_mode AS color, print_side AS side,
               original_pages AS pages, number_of_copies AS copies, (${SHEETS_SQL})::int AS sheets
        FROM requests WHERE ${rangeConds(params, from, upTo, true)}
        ORDER BY submission_date LIMIT ${Number(params.rowLimit) || 200000}`
    ]);
    matrix = matrix.map((m) => ({ ...m, sheets: Number(m.sheets) }));
  }
  return {
    from, to, today, upTo, bucket, prev, allTime,
    totals, prevTotals, series: out, units: unitList, rank,
    types: list(types, "type"), docs: list(docs, "value"), srcs: list(srcs, "value"),
    breakdown: { types: detail(breakdown.types), docs: detail(breakdown.docs), srcs: detail(breakdown.srcs) },
    matrix, requestRows
  };
}
function addYears(s, n) {
  const [y, m, d] = dayParts(s);
  return dayStr(y + n, m, d);
}

async function dashboardSummary({ year, month, documentType, paperSource, fromDate, toDate, unitType, unit } = {}) {
  const scopedWhere = {};
  if (documentType) scopedWhere.documentType = documentType;
  if (paperSource) scopedWhere.paperSource = paperSource;
  if (unitType) scopedWhere.unitType = unitType;
  if (unit) scopedWhere.unit = unit;

  const hasCustomRange = !!(fromDate || toDate);
  const hasYear = year !== undefined && year !== null && year !== "";
  const hasMonth = month !== undefined && month !== null && month !== "";

  if (hasCustomRange) {
    const range = {};
    if (fromDate) range.gte = parseDateOnly(fromDate);
    if (toDate) {
      const to = parseDateOnly(toDate);
      to.setDate(to.getDate() + 1); // toDate itself is inclusive
      range.lt = to;
    }
    scopedWhere.submissionDate = range;
  } else if (hasYear && hasMonth) {
    const y = Number(year), m = Number(month);
    scopedWhere.submissionDate = { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) };
  } else if (hasYear) {
    const y = Number(year);
    scopedWhere.submissionDate = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
  } else if (hasMonth) {
    // No year given — match this calendar month across every year that has any data.
    const m = Number(month);
    const years = await listAvailableYears();
    scopedWhere.OR = years.map((y) => ({ submissionDate: { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) } }));
  }

  // Trend chart always spans every year but still respects documentType/paperSource.
  // When no date filter is set at all, that's the exact same query as
  // scopedRows — skip the duplicate round-trip and reuse the one result for both.
  const dateFilterActive = hasCustomRange || hasYear || hasMonth;
  const scopedRows = await prisma.request.findMany({ where: scopedWhere, select: DASHBOARD_SELECT });
  const trendRows = dateFilterActive
    ? await prisma.request.findMany({
        where: { documentType: scopedWhere.documentType, paperSource: scopedWhere.paperSource },
        select: DASHBOARD_SELECT
      })
    : scopedRows;

  const printedRows = scopedRows.filter((r) => PRINTED_STATUS_ENUMS.includes(r.status));
  const totalRequests = scopedRows.length;
  const totalSheets = printedRows.reduce((sum, r) => sum + computeSheets(r), 0);
  const avgSheets = totalRequests > 0 ? Math.round(totalSheets / totalRequests) : 0;
  // Grouped by id when the request has one (survives a category/unit
  // rename — see the plan comment on Request.unitTypeId), falling
  // back to the raw strings for older/unmatched rows that have none.
  const activeUnits = new Set(printedRows.map((r) => (r.unitId != null ? `id:${r.unitId}` : `str:${r.unitType}||${r.unit}`))).size;

  // Current category names (nameEn especially) for whichever ids show up
  // below — cheap, the whole table is a dozen rows — so a rename is
  // reflected immediately instead of only in newly-submitted rows.
  const categoryById = new Map((await unitDirectory.listAllCategories()).map((c) => [c.id, c]));

  const categoryMap = {};
  const unitMap = {};
  scopedRows.forEach((r) => {
    const live = r.unitTypeId != null ? categoryById.get(r.unitTypeId) : null;
    const catKey = r.unitTypeId != null ? `id:${r.unitTypeId}` : `str:${r.unitType}`;
    if (!categoryMap[catKey]) {
      categoryMap[catKey] = {
        category: live ? live.nameTh : r.unitType,
        categoryEn: live ? live.nameEn : null,
        count: 0, copies: 0, sheets: 0
      };
    }
    categoryMap[catKey].count += 1;

    const unitKey = r.unitId != null ? `id:${r.unitId}` : `str:${catKey}||${r.unit}`;
    if (!unitMap[unitKey]) {
      unitMap[unitKey] = {
        unit: r.unit,
        category: categoryMap[catKey].category,
        categoryEn: categoryMap[catKey].categoryEn,
        count: 0, copies: 0, sheets: 0
      };
    }
    unitMap[unitKey].count += 1;

    if (PRINTED_STATUS_ENUMS.includes(r.status)) {
      const sheets = computeSheets(r);
      categoryMap[catKey].copies += Number(r.numberOfCopies || 0);
      categoryMap[catKey].sheets += sheets;
      unitMap[unitKey].copies += Number(r.numberOfCopies || 0);
      unitMap[unitKey].sheets += sheets;
    }
  });

  const yearTrend = {};
  trendRows.forEach((r) => {
    if (PRINTED_STATUS_ENUMS.includes(r.status)) {
      const y = r.submissionDate.getFullYear();
      yearTrend[y] = (yearTrend[y] || 0) + computeSheets(r);
    }
  });
  const availableYears = Array.from(new Set(trendRows.map((r) => r.submissionDate.getFullYear()))).sort((a, b) => b - a);

  return {
    totalRequests,
    totalSheets,
    avgSheets,
    activeUnits,
    availableYears,
    yearTrend,
    categoryBreakdown: Object.values(categoryMap),
    unitBreakdown: Object.values(unitMap)
  };
}

// FR-03/04/05 — validates the proposed completion date server-side (never
// trust the client's disabled-button UX alone) and assigns the Request
// Reference Number + drop-off deadline atomically.
//
// Shared by create() and update(): validates one submitted form and maps it
// to the DB columns. `submissionDate` is "now" for a new request but the
// original submission time when editing, so an edit never moves the
// minimum-completion-date goalposts (a request filed Monday can still keep
// its date if edited Thursday).
function buildRequestFields(input, submissionDate) {
  // "Z" forces UTC-midnight parsing, matching the UTC convention @db.Date
  // columns round-trip as (see toDateInputValue below) — without it, this
  // parses as *local* midnight, which now that the server's TZ is
  // Asia/Bangkok (not UTC) shifted the stored date back by a day.
  const proposed = new Date(input.appointmentDateProposed + "T00:00:00Z");
  const minDate = businessDays.minCompletionDate(submissionDate);
  minDate.setHours(0, 0, 0, 0);

  if (isNaN(proposed.getTime()) || proposed < minDate) {
    return { error: "completion-date-too-soon" };
  }
  if (!businessDays.isBusinessDay(proposed)) {
    return { error: "completion-date-weekend" };
  }

  if (String(input.itemList || "").trim().length > ITEM_LIST_MAX) {
    return { error: "item-list-too-long" };
  }

  const colorMode = COLOR_MODE_TH[input.colorMode];
  const printSide = PRINT_SIDE_TH[input.printSide];
  const documentType = DOCUMENT_TYPE_TH[input.documentType];
  if (!colorMode || !printSide || !documentType) {
    return { error: "missing-required-field" };
  }

  // FR-03: Paper Source is only a real choice for Exam; for General
  // Document the system fixes it to Requester-provided regardless of what
  // (if anything) the client sent — never trust the client alone here,
  // the same way the completion-date checks above are re-verified server-side.
  let paperSource;
  if (input.documentType === "exam") {
    paperSource = PAPER_SOURCE_TH[input.paperSource];
    if (!paperSource) return { error: "missing-required-field" };
  } else {
    paperSource = PAPER_SOURCE_TH.requester;
  }

  // Unrecognized codes are dropped rather than rejected — same tolerance
  // the old array-based finishingOption/bindingOption fields had.
  const finishingCodes = [].concat(input.finishingMethods || [])
    .filter((code) => Object.prototype.hasOwnProperty.call(FINISHING_METHOD_TH, code));

  if (input.documentType === "exam" && finishingCodes.some((code) => !EXAM_ALLOWED_FINISHING.has(code))) {
    return { error: "finishing-not-allowed-for-exam" };
  }

  const hasExclusiveConflict = EXCLUSIVE_FINISHING_GROUPS.some(
    (group) => finishingCodes.filter((code) => group.includes(code)).length > 1
  );
  if (hasExclusiveConflict) {
    return { error: "finishing-conflict" };
  }

  // Saddle-stitch folds the sheet in half and staples through the spine,
  // which physically requires both sides to already be printed.
  if (finishingCodes.includes("saddleStitch") && input.printSide !== "double") {
    return { error: "finishing-requires-double-side" };
  }

  const originalPages = parseInt(input.originalPages, 10);
  const pageCountInvalid = finishingCodes.some((code) => {
    const limit = FINISHING_PAGE_LIMITS[code];
    if (!limit) return false;
    const tooFew = limit.min !== undefined && originalPages < limit.min;
    const tooMany = limit.max !== undefined && originalPages > limit.max;
    const notMultiple = limit.multipleOf !== undefined && originalPages % limit.multipleOf !== 0;
    return tooFew || tooMany || notMultiple;
  });
  if (pageCountInvalid) {
    return { error: "finishing-page-count-invalid" };
  }

  const finishingMethods = finishingCodes.map((code) => FINISHING_METHOD_TH[code]);

  const numberOfCopies = parseInt(input.numberOfCopies, 10);
  if (!numberOfCopies || numberOfCopies < 1 || numberOfCopies > MAX_COPIES) {
    return { error: "copies-out-of-range" };
  }

  const copyLabelEnabled = !!input.copyLabelEnabled;
  const copyLabelMode = copyLabelEnabled && input.copyLabelMode === "manual" ? "manual" : "auto";
  let copyLabelPrefix = null;
  let copyLabelStart = null;
  let copyLabelManual = [];

  if (copyLabelEnabled && copyLabelMode === "manual") {
    // v0.7 — free-text label per copy, entered directly by the Requester
    // instead of an auto-incrementing prefix+number. Never trust the
    // client's disabled-input UX alone: re-check the count and that none
    // are blank server-side too.
    copyLabelManual = [].concat(input.copyLabelManual || []).map((v) => (v || "").trim());
    if (copyLabelManual.length !== numberOfCopies || copyLabelManual.some((v) => !v)) {
      return { error: "copy-label-manual-invalid" };
    }
  } else if (copyLabelEnabled) {
    // Auto mode always runs 1..numberOfCopies (zero-padded to 3 digits on
    // display) — the Requester no longer picks a prefix or starting number.
    copyLabelStart = 1;
  }

  return {
    fields: {
      requesterName: input.requesterName,
      requesterTel: input.requesterTel,
      paperSize: input.paperSize,
      colorMode,
      printSide,
      finishingMethods,
      documentType,
      paperSource,
      copyLabelEnabled,
      copyLabelMode: copyLabelEnabled ? copyLabelMode : null,
      copyLabelPrefix,
      copyLabelStart,
      copyLabelManual,
      itemList: input.itemList,
      originalPages,
      numberOfCopies,
      appointmentDateProposed: proposed
    }
  };
}

// Where the Requester will bring the original document. With no drop-off
// place configured at all there is nothing to choose (no fields, not an
// error); with exactly one the form doesn't ask, so a missing id means "that
// one"; with several the id must name an active one that accepts drop-offs —
// re-checked here rather than trusting the form's <select>.
async function resolveDropoff(rawId) {
  const options = await locations.listActive("dropoff");
  if (options.length === 0) return { fields: {} };

  const id = parseInt(rawId, 10);
  const chosen = id ? options.find((l) => l.id === id) : (options.length === 1 ? options[0] : null);
  if (!chosen) return { error: "dropoff-location-invalid" };

  return { fields: { dropoffLocationId: chosen.id, dropoffLocationSnapshot: locations.snapshotOf(chosen) }, location: chosen };
}

async function create(input) {
  const submissionDate = new Date();
  const built = buildRequestFields(input, submissionDate);
  if (built.error) return built;
  const dropoffLocation = await resolveDropoff(input.dropoffLocationId);
  if (dropoffLocation.error) return dropoffLocation;
  const unit = await unitDirectory.resolveUnit({
    categoryId: input.unitTypeId, unitId: input.unitId, unitText: input.unitText
  });
  if (unit.error) return unit;

  const dropoffWindow = locations.hourWindowOf(dropoffLocation.location);
  const dropoff = businessDays.computeDropoffDeadline(submissionDate, dropoffWindow ? dropoffWindow.end : undefined);
  const requestReferenceNo = await counters.nextReferenceNo();

  const created = await prisma.request.create({
    data: {
      requestReferenceNo,
      requesterEmail: input.requesterEmail,
      ...built.fields,
      ...dropoffLocation.fields,
      ...unit.fields,
      submissionDate,
      originalDocDeadline: dropoff.date,
      status: "AWAITING_ORIGINAL_DOCUMENT"
    }
  });

  // Best-effort and non-blocking: the submission already succeeded in the
  // database, so email/notification delivery (which can be slow) must not
  // delay the HTTP response — a slow response is what caused requesters to
  // double-click submit and create duplicate requests.
  notifications.notifyRequesterStatusChange(created, "submitted")
    .catch((err) => console.error("[notifications] submitted notify failed:", err.message));
  notifications.notifyOfficersNewRequest(created)
    .catch((err) => console.error("[notifications] new-request officer notify failed:", err.message));

  return toClientJSON(created);
}

// A request can be corrected until an Officer acts on it: the Requester has
// to bring the original document to the counter before anyone approves it,
// so it normally sits in AWAITING_ORIGINAL_DOCUMENT for a while. Ownership
// and status live in the WHERE of a single updateMany (same pattern as
// cancel() below) so an edit can never overwrite a request an Officer just
// approved/rejected, or one that isn't the caller's.
async function findEditable(ref, requesterEmail) {
  return prisma.request.findFirst({
    where: { requestReferenceNo: ref, requesterEmail, status: "AWAITING_ORIGINAL_DOCUMENT" }
  });
}

async function update(ref, input) {
  const existing = await findEditable(ref, input.requesterEmail);
  if (!existing) return { error: "not-editable" };

  const built = buildRequestFields(input, existing.submissionDate);
  if (built.error) return built;
  const dropoffLocation = await resolveDropoff(input.dropoffLocationId);
  if (dropoffLocation.error) return dropoffLocation;
  const unit = await unitDirectory.resolveUnit({
    categoryId: input.unitTypeId, unitId: input.unitId, unitText: input.unitText
  });
  if (unit.error) return unit;

  const result = await prisma.request.updateMany({
    where: { requestReferenceNo: ref, requesterEmail: input.requesterEmail, status: "AWAITING_ORIGINAL_DOCUMENT" },
    data: { ...built.fields, ...dropoffLocation.fields, ...unit.fields }
  });
  if (result.count === 0) return { error: "not-editable" };

  const updated = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  return toClientJSON(updated);
}

// Inverse of the write-boundary mapping in buildRequestFields: turns a
// stored request back into the short codes / raw values the request form's
// own inputs use, so the same form can be re-opened pre-filled for editing.
function invertMap(map) {
  return Object.fromEntries(Object.entries(map).map(([code, label]) => [label, code]));
}

async function getEditPrefill(ref, requesterEmail) {
  const row = await findEditable(ref, requesterEmail);
  if (!row) return null;

  const finishingByLabel = invertMap(FINISHING_METHOD_TH);
  return {
    referenceNo: row.requestReferenceNo,
    requesterName: row.requesterName,
    requesterTel: row.requesterTel,
    unitType: row.unitType,
    unit: row.unit,
    unitTypeId: row.unitTypeId,
    unitId: row.unitId,
    dropoffLocationId: row.dropoffLocationId,
    form: {
      documentType: invertMap(DOCUMENT_TYPE_TH)[row.documentType] || "",
      paperSource: invertMap(PAPER_SOURCE_TH)[row.paperSource] || "",
      paperSize: row.paperSize,
      colorMode: invertMap(COLOR_MODE_TH)[row.colorMode] || "",
      printSide: invertMap(PRINT_SIDE_TH)[row.printSide] || "",
      finishingMethods: row.finishingMethods.map((label) => finishingByLabel[label]).filter(Boolean),
      itemList: row.itemList,
      originalPages: row.originalPages,
      copies: row.numberOfCopies,
      copyLabelEnabled: row.copyLabelEnabled,
      copyLabelMode: row.copyLabelMode || "auto",
      copyLabelManual: row.copyLabelManual[0] || "",
      completionDate: toDateInputValue(row.appointmentDateProposed)
    }
  };
}

// Claim Code is a random 6-digit value (1M possible codes) with no
// database-level uniqueness constraint — at the ~19k codes already issued
// in this dataset, birthday-paradox collisions are expected (found 184
// duplicate codes in the live data, 2026-09-01), and a collision against an
// unrelated request can make Counter Handover's claim-code search wrongly
// report "not found" for a real, ready-for-pickup request (see the scoped
// query in getByClaimCode above, added the same day as a fix for exactly
// that).
//
// Only checked against requests still "live" (PRINTING_IN_PROGRESS /
// READY_FOR_PICKUP) — a claim code stops mattering once a request is
// COMPLETED (Counter Handover never looks it up again after that), so
// there's no need to keep checking against the whole ever-growing request
// history forever. This also keeps the live set roughly constant-sized
// over time instead of the check getting slower/more collision-prone as
// total request volume grows.
async function generateUniqueClaimCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0"); // CSPRNG: codes cannot be predicted from earlier ones
    const clash = await prisma.request.findFirst({
      where: { claimCode: code, status: { in: ["PRINTING_IN_PROGRESS", "READY_FOR_PICKUP"] } }
    });
    if (!clash) return code;
  }
  throw new Error("Could not generate a unique claim code");
}

// FR-10 — Approve and Receive Master: issues RUN NUMBER + Claim Code via
// the atomic counters, confirms the completion date, moves the request
// into Printing In Progress.
async function approve(ref, { confirmedDate, officerEmail, officerName }) {
  const existing = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!existing || existing.status !== "AWAITING_ORIGINAL_DOCUMENT") return null;

  const runNumber = await counters.nextRunNumber();
  const claimCode = await generateUniqueClaimCode();

  const updated = await prisma.request.update({
    where: { requestReferenceNo: ref },
    data: {
      runNumber,
      claimCode,
      appointmentDateConfirmed: new Date(confirmedDate),
      originalDocReceivedTimestamp: new Date(),
      reviewedByOfficerEmail: officerEmail,
      reviewedByOfficerName: officerName,
      status: "PRINTING_IN_PROGRESS"
    }
  });

  // Non-blocking: don't make the officer wait on email/notification delivery
  // before the UI can report the approval as done.
  notifications.notifyRequesterStatusChange(updated, "approved", {
    claimCode: updated.claimCode,
    confirmedDate: updated.appointmentDateConfirmed
  }).catch((err) => console.error("[notifications] approved notify failed:", err.message));

  return toClientJSON(updated);
}

// FR-11 — Reject with reason.
async function reject(ref, { reason, officerEmail, officerName }) {
  const existing = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!existing || existing.status !== "AWAITING_ORIGINAL_DOCUMENT") return null;

  const updated = await prisma.request.update({
    where: { requestReferenceNo: ref },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason,
      reviewedByOfficerEmail: officerEmail,
      reviewedByOfficerName: officerName
    }
  });

  notifications.notifyRequesterStatusChange(updated, "rejected", { reason: updated.rejectionReason })
    .catch((err) => console.error("[notifications] rejected notify failed:", err.message));

  return toClientJSON(updated);
}

// Requester-initiated withdrawal of a request that hasn't been acted on yet
// (same window as update() above). updateMany's WHERE
// (not a findUnique-then-update) makes the status flip and that race check
// one atomic statement: if the Officer's approve()/reject() already moved
// the row off AWAITING_ORIGINAL_DOCUMENT, this simply matches zero rows
// instead of overwriting whatever they just did.
async function cancel(ref, { requesterEmail }) {
  const result = await prisma.request.updateMany({
    where: { requestReferenceNo: ref, requesterEmail, status: "AWAITING_ORIGINAL_DOCUMENT" },
    data: { status: "CANCELLED", cancelledAt: new Date() }
  });
  if (result.count === 0) return null;

  const updated = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });

  notifications.notifyOfficersCancelled(updated)
    .catch((err) => console.error("[notifications] cancelled notify failed:", err.message));

  return toClientJSON(updated);
}

// Where the finished copies can be collected. Unlike the drop-off place the
// Requester chooses, this is the Officer's call, made when marking ready:
// nothing sent means "the default pickup place"; an id must name an active
// place that accepts pickups. With no pickup place configured at all there is
// nothing to record (no fields, not an error).
async function resolvePickup(rawId) {
  const options = await locations.listActive("pickup");
  if (options.length === 0) return { fields: {} };

  const id = parseInt(rawId, 10);
  const chosen = id
    ? options.find((l) => l.id === id)
    : (options.find((l) => l.isDefaultPickup) || options[0]);
  if (!chosen) return { error: "pickup-location-invalid" };

  return { fields: { pickupLocationId: chosen.id, pickupLocationSnapshot: locations.snapshotOf(chosen) }, location: chosen };
}

// The moment from which the Requester may collect the copies, chosen by the
// Officer. Must fall on a business day inside the pickup place's real hours
// (`window`, from locations.hourWindowOf — the site-wide default window
// when that place has no structured hours, or none was chosen at all);
// re-checked here rather than trusting the modal's lists. Omitted means "as
// soon as possible": now if the counter is open, otherwise the next
// opening.
function resolvePickupTime(raw, now = new Date(), window) {
  const start = window ? window.start : businessDays.BUSINESS_HOUR_START;
  const end = window ? window.end : businessDays.BUSINESS_HOUR_END;
  const hourOf = (d) => d.getHours() + d.getMinutes() / 60;

  if (raw == null || raw === "") {
    if (businessDays.isBusinessDay(now) && hourOf(now) < end) {
      if (hourOf(now) >= start) return { value: now };
      const opening = businessDays.setClockHour(new Date(now), start);
      return { value: opening };
    }
    const next = businessDays.setClockHour(businessDays.nextBusinessDay(now), start);
    return { value: next };
  }

  const at = new Date(raw);
  if (isNaN(at.getTime())) return { error: "pickup-time-invalid" };
  const fiveMinutes = 5 * 60 * 1000;
  // Up to a year ahead (the "mark ready" dialog offers the same range).
  const maxAhead = 367 * 24 * 60 * 60 * 1000;
  if (at.getTime() < now.getTime() - fiveMinutes || at.getTime() > now.getTime() + maxAhead) return { error: "pickup-time-invalid" };
  // Any day/time is allowed here: the Officer decides (weekend or late
  // pickups by arrangement). The Requester is still shown the place's
  // opening hours next to this time (messages.ready).
  return { value: at };
}

// FR-12 — Mark Ready for Pickup. Returns null when the request isn't in
// Printing In Progress, { error } for a bad pickup place or time.
async function markReady(ref, { pickupLocationId, pickupAvailableFrom, officerEmail, officerName } = {}) {
  const existing = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!existing || existing.status !== "PRINTING_IN_PROGRESS") return null;

  const pickup = await resolvePickup(pickupLocationId);
  if (pickup.error) return pickup;
  const pickupWindow = locations.hourWindowOf(pickup.location);
  const availableFrom = resolvePickupTime(pickupAvailableFrom, new Date(), pickupWindow);
  if (availableFrom.error) return availableFrom;

  const updated = await prisma.request.update({
    where: { requestReferenceNo: ref },
    data: {
      status: "READY_FOR_PICKUP", ...pickup.fields, pickupAvailableFrom: availableFrom.value,
      readyAt: new Date(),
      markedReadyByOfficerEmail: officerEmail || null,
      markedReadyByOfficerName: officerName || null
    }
  });

  notifications.notifyRequesterStatusChange(updated, "ready")
    .catch((err) => console.error("[notifications] ready notify failed:", err.message));

  return toClientJSON(updated);
}

// FR-14 — Record Receiver name/position/work phone (accountability record,
// not an identity check — no physical ID is inspected), confirm handover.
async function handover(ref, { receiverName, receiverPosition, receiverWorkplace, receiverWorkPhone, officerEmail, officerName }) {
  const existing = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!existing || existing.status !== "READY_FOR_PICKUP") return null;

  const updated = await prisma.request.update({
    where: { requestReferenceNo: ref },
    data: {
      status: "COMPLETED",
      receiverName,
      receiverPosition,
      receiverWorkplace,
      receiverWorkPhone,
      completedTimestamp: new Date(),
      handedOverByOfficerEmail: officerEmail,
      handedOverByOfficerName: officerName
    }
  });

  notifications.notifyRequesterStatusChange(updated, "completed")
    .catch((err) => console.error("[notifications] completed notify failed:", err.message));

  return toClientJSON(updated);
}

// D — location relocation notices (src/locations.js admin edit/archive
// flows). "In-flight" for a purpose means a request that still needs that
// place: AWAITING_ORIGINAL_DOCUMENT for drop-off, READY_FOR_PICKUP for
// pickup — anything past that has already used the place, so a later edit
// there can't affect it.
const IN_FLIGHT_STATUS = { dropoff: "AWAITING_ORIGINAL_DOCUMENT", pickup: "READY_FOR_PICKUP" };
const IN_FLIGHT_FIELD = { dropoff: "dropoffLocationId", pickup: "pickupLocationId" };

async function findInFlightForLocation(locationId, purpose) {
  return prisma.request.findMany({
    where: { [IN_FLIGHT_FIELD[purpose]]: Number(locationId), status: IN_FLIGHT_STATUS[purpose] }
  });
}

// Single-location counts for the "does this edit/archive affect anyone?"
// check the admin UI needs before it even offers the typo/moved choice.
async function countInFlightForLocation(locationId) {
  const [dropoff, pickup] = await Promise.all([
    prisma.request.count({ where: { dropoffLocationId: Number(locationId), status: IN_FLIGHT_STATUS.dropoff } }),
    prisma.request.count({ where: { pickupLocationId: Number(locationId), status: IN_FLIGHT_STATUS.pickup } })
  ]);
  return { dropoff, pickup };
}

// Bulk version of the same counts, keyed by location id — what the admin
// locations list uses so it isn't N+1 queries for N locations.
async function countInFlightByLocation() {
  const [dropoffRows, pickupRows] = await Promise.all([
    prisma.request.groupBy({
      by: ["dropoffLocationId"],
      where: { status: IN_FLIGHT_STATUS.dropoff, dropoffLocationId: { not: null } },
      _count: { _all: true }
    }),
    prisma.request.groupBy({
      by: ["pickupLocationId"],
      where: { status: IN_FLIGHT_STATUS.pickup, pickupLocationId: { not: null } },
      _count: { _all: true }
    })
  ]);
  const map = {};
  dropoffRows.forEach((r) => {
    map[r.dropoffLocationId] = { dropoff: r._count._all, pickup: (map[r.dropoffLocationId] || {}).pickup || 0 };
  });
  pickupRows.forEach((r) => {
    map[r.pickupLocationId] = { dropoff: (map[r.pickupLocationId] || {}).dropoff || 0, pickup: r._count._all };
  });
  return map;
}

// Notifies every in-flight request for `purpose` that the place changed —
// either in place (an admin-confirmed "actually moved" edit, where
// fromLocationId === toLocationId and only the place's own data changed)
// or onto a replacement (archiving a place that still has in-flight
// requests). Only the second case reassigns the request's location id —
// an in-place edit already shows the new details wherever the request's
// live relation is read (see getByRef/getByClaimCode), no reassignment
// needed. Returns how many requests were notified, for the admin banner.
async function notifyLocationChange({ purpose, fromLocationId, toLocationId, oldLocation, newLocation }) {
  const affected = await findInFlightForLocation(fromLocationId, purpose);
  if (affected.length === 0) return 0;

  if (Number(toLocationId) !== Number(fromLocationId)) {
    await prisma.request.updateMany({
      where: { [IN_FLIGHT_FIELD[purpose]]: Number(fromLocationId), status: IN_FLIGHT_STATUS[purpose] },
      data: { [IN_FLIGHT_FIELD[purpose]]: Number(toLocationId) }
    });
  }

  await Promise.all(affected.map((r) => notifications.notifyLocationMoved(r, purpose, oldLocation, newLocation)));
  return affected.length;
}

// ---------------------------------------------------------------- evaluations
// The form itself is admin-editable (src/evaluationForm.js). A Requester is
// asked to evaluate each completed request, and blocked from submitting a
// new one (requireNoPendingEvaluation in routes/requester.js) while any is
// still open — "open" meaning: completed, not yet evaluated, the form has at
// least one question, and the pickup is still inside the admin's time window
// (evaluationForm.getWindow). Past the window it simply expires: no longer
// asked for, no longer blocking. Oldest first, one at a time.
async function evaluationCutoff() {
  const win = await evaluationForm.getWindow();
  return { win, cutoff: evaluationForm.oldestOpenCompletion(win.value, win.unit) };
}

async function getPendingEvaluation(requesterEmail) {
  if ((await evaluationForm.questionCount()) === 0) return null;
  const { win, cutoff } = await evaluationCutoff();
  const row = await prisma.request.findFirst({
    where: {
      requesterEmail, status: "COMPLETED", evaluation: null,
      ...(cutoff ? { completedTimestamp: { gte: cutoff } } : {})
    },
    orderBy: { completedTimestamp: "asc" }
  });
  if (!row) return null;
  const deadline = evaluationForm.deadlineFor(row.completedTimestamp, win.value, win.unit);
  return {
    referenceNo: row.requestReferenceNo, itemList: row.itemList,
    completedTimestamp: row.completedTimestamp.toISOString(),
    deadline: deadline ? deadline.toISOString() : null
  };
}

async function getEvaluation(ref) {
  return prisma.evaluation.findUnique({ where: { requestReferenceNo: ref } });
}

// Whether this Requester can evaluate this request right now:
// "open" | "done" | "expired" | "no-form" | "not-eligible".
async function evaluationState(ref, requesterEmail) {
  const request = await prisma.request.findUnique({
    where: { requestReferenceNo: ref }, include: { evaluation: { select: { id: true } } }
  });
  if (!request || request.requesterEmail !== requesterEmail || request.status !== "COMPLETED") return { state: "not-eligible" };
  if (request.evaluation) return { state: "done" };
  if ((await evaluationForm.questionCount()) === 0) return { state: "no-form" };
  const win = await evaluationForm.getWindow();
  const deadline = evaluationForm.deadlineFor(request.completedTimestamp, win.value, win.unit);
  if (deadline && deadline < new Date()) return { state: "expired", deadline };
  return { state: "open", deadline };
}

// body: the posted form (fields q_<questionId>). Saves the evaluation and
// one EvaluationAnswer per answered question, with the question text copied
// in. Returns { ok } or { error, errors? }.
async function submitEvaluation(ref, { requesterEmail, body }) {
  const status = await evaluationState(ref, requesterEmail);
  if (status.state === "done") return { error: "already-evaluated" };
  if (status.state === "expired") return { error: "expired" };
  if (status.state !== "open") return { error: "not-eligible" };

  const sections = await evaluationForm.listForm();
  const result = evaluationForm.validateAnswers(sections, body || {});
  if (result.errors) return { error: "invalid-answers", errors: result.errors };

  try {
    await prisma.evaluation.create({
      data: {
        requestReferenceNo: ref,
        requesterEmail,
        averageRating: result.averageRating,
        comment: result.comment,
        answers: { create: result.answers }
      }
    });
  } catch (err) {
    if (err.code === "P2002") return { error: "already-evaluated" }; // double submit
    throw err;
  }
  return { ok: true };
}

// Year scope on the evaluation's submittedAt (see evaluationsSummary).
function yearRange(year) {
  if (year === undefined || year === null || year === "") return null;
  const y = Number(year);
  return { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
}

// Overview for the officer report: KPIs plus per-question results for the
// current form (average + 1-5 spread for ratings, a count per option for
// single/multi, answer count for text). Answers to questions deleted since
// are grouped at the end as "removed" so old results don't vanish.
async function evaluationsSummary({ year } = {}) {
  const range = yearRange(year);
  const evalWhere = range ? { submittedAt: range } : {};

  const answerRange = range ? Prisma.sql`e.submitted_at >= ${range.gte} AND e.submitted_at < ${range.lt}` : Prisma.sql`TRUE`;
  const [totalEvaluated, totalWithComments, availableYears, sections, answers, overallAgg, evalSpan, choiceRows] = await Promise.all([
    prisma.evaluation.count({ where: evalWhere }),
    prisma.evaluation.count({ where: { ...evalWhere, comment: { not: null } } }),
    listEvaluationYears(),
    evaluationForm.listForm(),
    // Counted in SQL, one row per question snapshot and rating (and one per
    // chosen option below), so a period with tens of thousands of answers
    // never has to be loaded row by row.
    prisma.$queryRaw`
      SELECT a.question_id AS "questionId", a.question_type AS "questionType",
             a.question_text_th AS "questionTextTh", a.question_text_en AS "questionTextEn",
             a.section_title_th AS "sectionTitleTh", a.section_title_en AS "sectionTitleEn",
             a.rating, COUNT(*)::int AS n, MIN(e.submitted_at) AS "firstAt", MAX(e.submitted_at) AS "lastAt"
      FROM evaluation_answers a JOIN evaluations e ON e.id = a.evaluation_id
      WHERE ${answerRange}
      GROUP BY 1, 2, 3, 4, 5, 6, 7
      ORDER BY "firstAt"`, // oldest first: a question's earliest wording names it, as before
    // Headline: each respondent's own average (Evaluation.averageRating),
    // averaged over the period, so a person counts once however many
    // questions the form had when they answered.
    prisma.evaluation.aggregate({ where: { ...evalWhere, averageRating: { not: null } }, _avg: { averageRating: true }, _count: { averageRating: true } }),
    prisma.evaluation.aggregate({ where: evalWhere, _min: { submittedAt: true }, _max: { submittedAt: true } }),
    prisma.$queryRaw`
      SELECT a.question_id AS "questionId", a.question_type AS "questionType",
             a.question_text_th AS "questionTextTh", a.section_title_th AS "sectionTitleTh",
             c->>'key' AS key, c->>'th' AS th, c->>'en' AS en, COUNT(*)::int AS n
      FROM evaluation_answers a JOIN evaluations e ON e.id = a.evaluation_id
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(a.choices) = 'array' THEN a.choices ELSE '[]'::jsonb END) c
      WHERE ${answerRange}
      GROUP BY 1, 2, 3, 4, 5, 6, 7`
  ]);
  const periodFirst = evalSpan._min.submittedAt;
  const periodLast = evalSpan._max.submittedAt;

  const stats = new Map();
  const overallSpread = [0, 0, 0, 0, 0]; // every 1-5 answer in the period
  function statFor(key, seed) {
    if (!stats.has(key)) stats.set(key, { ...seed, count: 0, sum: 0, spread: [0, 0, 0, 0, 0], optionCounts: {}, optionLabels: {}, firstAt: null, lastAt: null });
    return stats.get(key);
  }
  // Answers to a deleted question are counted under a current question with
  // the same type, section and (Thai) wording, e.g. when an admin deleted a
  // question and created it again: they are one question in the report.
  // Their choices are matched to the current options by Thai label.
  const norm = (v) => String(v || "").trim().replace(/s+/g, " ");
  const liveBySnapshot = new Map();
  const liveOptionsByQ = new Map();
  for (const sec of sections) {
    for (const q of sec.questions) {
      const k = [q.type, norm(sec.titleTh), norm(q.textTh)].join("|");
      if (!liveBySnapshot.has(k)) liveBySnapshot.set(k, q.id);
      liveOptionsByQ.set(q.id, Array.isArray(q.options) ? q.options : []);
    }
  }
  // which stat an answer snapshot belongs to (see the note above)
  function keyFor(a) {
    let qid = a.questionId;
    if (qid == null) qid = liveBySnapshot.get([a.questionType, norm(a.sectionTitleTh), norm(a.questionTextTh)].join("|")) ?? null;
    return { qid, merged: a.questionId == null && qid != null, key: qid != null ? "q" + qid : ["x", a.questionType, a.sectionTitleTh, a.questionTextTh].join("|") };
  }
  for (const a of answers) {
    const { key } = keyFor(a);
    const st = statFor(key, {
      type: a.questionType, textTh: a.questionTextTh, textEn: a.questionTextEn,
      sectionTitleTh: a.sectionTitleTh, sectionTitleEn: a.sectionTitleEn
    });
    st.count += a.n;
    if (!st.firstAt || a.firstAt < st.firstAt) st.firstAt = a.firstAt;
    if (!st.lastAt || a.lastAt > st.lastAt) st.lastAt = a.lastAt;
    if (a.rating != null && a.rating >= 1 && a.rating <= 5) { st.sum += a.rating * a.n; st.spread[a.rating - 1] += a.n; overallSpread[a.rating - 1] += a.n; }
  }
  for (const c of choiceRows) {
    const { qid, merged, key } = keyFor(c);
    const st = stats.get(key);
    if (!st) continue;
    let ck = c.key;
    if (merged) {
      const same = (liveOptionsByQ.get(qid) || []).find((o) => norm(o.th) === norm(c.th));
      if (same) ck = same.key;
    }
    st.optionCounts[ck] = (st.optionCounts[ck] || 0) + c.n;
    if (!st.optionLabels[ck]) st.optionLabels[ck] = { th: c.th, en: c.en };
  }

  const round1 = (n) => Math.round(n * 10) / 10;
  function questionResult(base, st, currentOptions) {
    const count = st ? st.count : 0;
    const out = { ...base, count };
    if (base.type === "rating") {
      out.average = count ? round1(st.sum / count) : 0;
      out.spread = st ? st.spread : [0, 0, 0, 0, 0];
    } else if (base.type === "single" || base.type === "multi") {
      const seen = new Set();
      const opts = (currentOptions || []).map((o) => { seen.add(o.key); return { key: o.key, th: o.th, en: o.en, count: st ? st.optionCounts[o.key] || 0 : 0 }; });
      // options removed from the question but chosen in the past
      if (st) Object.keys(st.optionCounts).forEach((k) => {
        if (!seen.has(k)) opts.push({ key: k, th: st.optionLabels[k].th, en: st.optionLabels[k].en, count: st.optionCounts[k], removed: true });
      });
      out.options = opts;
    }
    return out;
  }

  // A period shows only the questions someone answered in it. A question
  // created after the period's first evaluation was added during it
  // (addedAt); a deleted one whose last answer is before the period's last
  // evaluation stopped being asked during it (removedAt). Either way not
  // every respondent saw it, which the report says next to it.
  const resultSections = sections.map((sec) => ({
    titleTh: sec.titleTh, titleEn: sec.titleEn,
    questions: sec.questions
      .filter((q) => stats.has("q" + q.id))
      .map((q) => {
        const out = questionResult(
          { id: q.id, type: q.type, textTh: q.textTh, textEn: q.textEn },
          stats.get("q" + q.id), Array.isArray(q.options) ? q.options : []
        );
        const st = stats.get("q" + q.id);
        const since = st && st.firstAt < q.createdAt ? st.firstAt : q.createdAt;
        if (periodFirst && since > periodFirst) out.addedAt = since.toISOString();
        return out;
      })
  })).filter((sec) => sec.questions.length);

  const overall = {
    average: overallAgg._avg.averageRating == null ? 0 : round1(overallAgg._avg.averageRating),
    count: overallAgg._count.averageRating,
    spread: overallSpread
  };

  const liveKeys = new Set(sections.flatMap((sec) => sec.questions.map((q) => "q" + q.id)));
  const removed = [];
  stats.forEach((st, key) => {
    if (liveKeys.has(key)) return;
    const out = questionResult({
      id: null, type: st.type, textTh: st.textTh, textEn: st.textEn,
      sectionTitleTh: st.sectionTitleTh, sectionTitleEn: st.sectionTitleEn, removed: true
    }, st, []);
    if (periodLast && st.lastAt < periodLast) out.removedAt = st.lastAt.toISOString();
    removed.push(out);
  });

  const completedWhere = { status: "COMPLETED" };
  const completedRange = yearRange(year);
  if (completedRange) completedWhere.completedTimestamp = completedRange;
  const totalCompleted = await prisma.request.count({ where: completedWhere });

  return { totalEvaluated, totalCompleted, totalWithComments, availableYears, overall, sections: resultSections, removed };
}

// All years that have at least one evaluation, regardless of any other
// filter — mirrors listAvailableYears() for requests, used the same way:
// building the "match this calendar month across every year with data" OR
// clause below when a month is picked without a year.
async function listEvaluationYears() {
  const rows = await prisma.evaluation.findMany({ select: { submittedAt: true } });
  return Array.from(new Set(rows.map((r) => r.submittedAt.getFullYear()))).sort((a, b) => b - a);
}

// Individual feedback log — paginated + searchable, same server-side pattern
// as searchHistory (including the year/month combination logic below, copied
// from there). `hasComment` narrows to evaluations with written feedback
// (any free-text answer); `sort: "lowest"` puts the lowest average rating
// first. Shared by searchEvaluations and the Excel export (src/reports.js).
async function buildEvaluationsWhere({ year, month, q, hasComment, fromDate, toDate } = {}) {
  const andClauses = [];

  // A custom from/to range (both ends inclusive) replaces year/month.
  const hasCustomRange = !!(fromDate || toDate);
  const hasYear = year !== undefined && year !== null && year !== "";
  const hasMonth = month !== undefined && month !== null && month !== "";
  if (hasCustomRange) {
    const range = {};
    if (fromDate) range.gte = parseDateOnly(fromDate);
    if (toDate) {
      const to = parseDateOnly(toDate);
      to.setDate(to.getDate() + 1);
      range.lt = to;
    }
    andClauses.push({ submittedAt: range });
  } else if (hasYear && hasMonth) {
    const y = Number(year), m = Number(month);
    andClauses.push({ submittedAt: { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) } });
  } else if (hasYear) {
    const y = Number(year);
    andClauses.push({ submittedAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } });
  } else if (hasMonth) {
    const m = Number(month);
    const years = await listEvaluationYears();
    andClauses.push({
      OR: years.map((y) => ({ submittedAt: { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) } }))
    });
  }

  if (hasComment) {
    andClauses.push({ comment: { not: null } });
  }
  if (q) {
    const contains = { contains: q, mode: "insensitive" };
    andClauses.push({
      OR: [
        { requestReferenceNo: contains },
        { comment: contains },
        { request: { requesterName: contains } },
        { request: { runNumber: contains } }
      ]
    });
  }

  return andClauses.length > 0 ? { AND: andClauses } : {};
}

// "lowest" = lowest average score first.
function evaluationsOrderBy(sort) {
  return sort === "lowest"
    ? [{ averageRating: { sort: "asc", nulls: "last" } }, { submittedAt: "desc" }]
    : { submittedAt: "desc" };
}

async function searchEvaluations({ year, month, q, page, pageSize, hasComment, sort, fromDate, toDate } = {}) {
  const where = await buildEvaluationsWhere({ year, month, q, hasComment, fromDate, toDate });
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));

  const [total, rows] = await Promise.all([
    prisma.evaluation.count({ where }),
    prisma.evaluation.findMany({
      where,
      orderBy: evaluationsOrderBy(sort),
      skip: (pageNum - 1) * size,
      take: size,
      include: {
        request: {
          select: {
            runNumber: true, requesterName: true, itemList: true,
            reviewedByOfficerName: true, handedOverByOfficerName: true
          }
        },
        answers: {
          where: { questionType: "rating" },
          orderBy: { id: "asc" },
          select: { questionTextTh: true, questionTextEn: true, rating: true }
        }
      }
    })
  ]);

  // Mirrors the officerLabel fallback used in officer/history.ejs: prefer
  // whoever handed the finished job over (the Requester's last real
  // interaction), fall back to whoever approved it at drop-off.
  const records = rows.map((e) => ({
    referenceNo: e.requestReferenceNo,
    runNumber: e.request.runNumber,
    requesterName: e.request.requesterName,
    itemList: e.request.itemList,
    officerName: e.request.handedOverByOfficerName || e.request.reviewedByOfficerName || null,
    averageRating: e.averageRating == null ? null : Math.round(e.averageRating * 10) / 10,
    ratings: e.answers.map((a) => ({ th: a.questionTextTh, en: a.questionTextEn, rating: a.rating })),
    comment: e.comment,
    submittedAt: e.submittedAt.toISOString()
  }));

  return { records, total, page: pageNum, pageSize: size };
}

module.exports = {
  generateUniqueClaimCode,
  getByRef, getByClaimCode, listByRequester, listAwaiting, listPrinting, listAvailableYears, searchHistory,
  create, update, getEditPrefill, approve, reject, cancel, markReady, resolvePickupTime, handover, dashboardSummary, dashboardOptions, dashboardRange, getPendingEvaluation, getEvaluation, evaluationState, submitEvaluation,
  evaluationsSummary, searchEvaluations,
  buildHistoryWhere, buildEvaluationsWhere, evaluationsOrderBy, computeSheets, PRINTED_STATUS_ENUMS,
  countInFlightForLocation, countInFlightByLocation, notifyLocationChange,
  STATUS_TO_CODE, CODE_TO_STATUS
};
